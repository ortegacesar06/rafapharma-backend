import Anthropic from "@anthropic-ai/sdk"
import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AI_ASSISTANT_MODULE } from "../../modules/ai-assistant"
import type AiAssistantModuleService from "../../modules/ai-assistant/service"
import type { SimilarProduct } from "../../modules/ai-assistant/service"
import { voyageEmbed } from "../../modules/ai-assistant/voyage"

const HISTORY_LIMIT = 12
const RAG_TOP_K = 5
const MAX_TOKENS = 1024

const SYSTEM_PROMPT = `Eres el asistente virtual de Rafapharma, una tienda ecuatoriana de suplementos deportivos y de fitness.

Tu rol:
- Recomendar productos del catálogo cuando el cliente pregunta por un objetivo (ganar masa, perder grasa, energía, recuperación, etc.).
- Responder dudas sobre uso, momento del día, combinaciones y precauciones generales.
- Ser breve, claro y directo. Habla en español neutro con voseo evitado.

Reglas:
- Si recomiendas productos, usa SOLO los productos del catálogo que aparecen en el contexto. Cita el título exacto.
- No inventes productos ni precios. Si el catálogo no tiene un producto adecuado, dilo.
- No das diagnóstico médico. Para condiciones específicas, sugiere consultar con un profesional de la salud.
- Si la pregunta no es sobre suplementos/fitness/la tienda, redirígela amablemente.`

type ChatRespondInput = {
  conversation_id: string
  user_message: string
}

type ChatRespondOutput = {
  assistant_message: string
  user_message_id: string
  assistant_message_id: string
  input_tokens: number
  output_tokens: number
}

const persistUserStep = createStep(
  "persist-user-message",
  async (input: ChatRespondInput, { container }) => {
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    const [msg] = await svc.createMessages([
      {
        conversation_id: input.conversation_id,
        role: "user",
        content: input.user_message,
      },
    ])
    return new StepResponse({ id: msg.id }, { id: msg.id })
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    await svc.deleteMessages([compensation.id])
  }
)

const loadHistoryStep = createStep(
  "load-conversation-history",
  async (
    args: { conversation_id: string; up_to_message_id: string },
    { container }
  ) => {
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    const messages = await svc.listMessages(
      { conversation_id: args.conversation_id },
      { order: { created_at: "DESC" }, take: HISTORY_LIMIT }
    )
    const ordered = [...messages].reverse() as {
      id: string
      role: "user" | "assistant" | "system"
      content: string
    }[]
    return new StepResponse({ history: ordered })
  }
)

const retrieveRagStep = createStep(
  "retrieve-relevant-products",
  async (args: { user_message: string }, { container }) => {
    const apiKey = process.env.VOYAGE_API_KEY
    if (!apiKey) {
      return new StepResponse({ products: [] as SimilarProduct[] })
    }
    const model = process.env.VOYAGE_MODEL || "voyage-3-lite"
    const { embeddings } = await voyageEmbed({
      texts: [args.user_message],
      model,
      apiKey,
      inputType: "query",
    })
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    const products = await svc.findSimilarProducts({
      embedding: embeddings[0],
      limit: RAG_TOP_K,
    })
    return new StepResponse({ products })
  }
)

export function buildContextBlock(products: SimilarProduct[]): string {
  if (!products.length) {
    return "(no hay productos relevantes recuperados)"
  }
  return products
    .map((p, i) => `${i + 1}. ${p.source_text.replace(/\s+/g, " ").trim().slice(0, 600)}`)
    .join("\n\n")
}

export function buildAnthropicMessages(
  history: { role: "user" | "assistant" | "system"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  // Anthropic sólo acepta user/assistant en messages. Filtramos system y combinamos consecutivos.
  const filtered = history.filter((m) => m.role !== "system") as {
    role: "user" | "assistant"
    content: string
  }[]
  const out: { role: "user" | "assistant"; content: string }[] = []
  for (const m of filtered) {
    const last = out[out.length - 1]
    if (last && last.role === m.role) {
      last.content += `\n\n${m.content}`
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  // Anthropic requiere que el primer mensaje sea user.
  while (out.length && out[0].role !== "user") out.shift()
  return out
}

const callClaudeStep = createStep(
  "call-claude",
  async (
    args: {
      history: { id: string; role: "user" | "assistant" | "system"; content: string }[]
      products: SimilarProduct[]
    },
    { container }
  ) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("call-claude: ANTHROPIC_API_KEY missing")
    }
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"
    const client = new Anthropic({ apiKey })

    const contextBlock = buildContextBlock(args.products)
    const messages = buildAnthropicMessages(args.history)

    if (messages.length === 0) {
      throw new Error("call-claude: no hay mensajes user válidos en el historial")
    }

    // System como bloques con cache_control en el prompt fijo (frecuente y reutilizable);
    // el contexto RAG va en un segundo bloque sin cache (varía cada turno).
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Productos relevantes del catálogo (puedes citarlos):\n\n${contextBlock}`,
        },
      ],
      messages,
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()

    return new StepResponse({
      assistant_message: text || "Lo siento, no pude generar una respuesta.",
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    })
  }
)

const persistAssistantStep = createStep(
  "persist-assistant-message",
  async (
    args: {
      conversation_id: string
      assistant_message: string
      input_tokens: number
      output_tokens: number
    },
    { container }
  ) => {
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    const [msg] = await svc.createMessages([
      {
        conversation_id: args.conversation_id,
        role: "assistant",
        content: args.assistant_message,
        input_tokens: args.input_tokens,
        output_tokens: args.output_tokens,
      },
    ])
    return new StepResponse({ id: msg.id }, { id: msg.id })
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    await svc.deleteMessages([compensation.id])
  }
)

export const chatRespondWorkflow = createWorkflow(
  "chat-respond",
  (input: ChatRespondInput) => {
    const userMsg = persistUserStep(input)
    const loaded = loadHistoryStep({
      conversation_id: input.conversation_id,
      up_to_message_id: userMsg.id,
    })
    const rag = retrieveRagStep({ user_message: input.user_message })
    const claude = callClaudeStep({ history: loaded.history, products: rag.products })
    const assistantMsg = persistAssistantStep({
      conversation_id: input.conversation_id,
      assistant_message: claude.assistant_message,
      input_tokens: claude.input_tokens,
      output_tokens: claude.output_tokens,
    })

    const result: ChatRespondOutput = {
      assistant_message: claude.assistant_message,
      user_message_id: userMsg.id,
      assistant_message_id: assistantMsg.id,
      input_tokens: claude.input_tokens,
      output_tokens: claude.output_tokens,
    } as any
    return new WorkflowResponse(result)
  }
)
