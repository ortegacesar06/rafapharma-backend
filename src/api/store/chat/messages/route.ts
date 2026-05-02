import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { AI_ASSISTANT_MODULE } from "../../../../modules/ai-assistant"
import type AiAssistantModuleService from "../../../../modules/ai-assistant/service"
import { chatRespondWorkflow } from "../../../../workflows/ai-assistant/chat-respond"

type Body = {
  conversation_id?: string
  message?: string
}

const HOUR_SECONDS = 3600
const MAX_MESSAGE_LEN = 2000

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
  return fwd || req.ip || "unknown"
}

function hourBucket(): string {
  return new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
}

async function checkAndIncrementLimit(
  cache: any,
  key: string,
  limit: number,
  logger: any
): Promise<boolean> {
  try {
    const current = (await cache.get(key)) as number | null
    const used = typeof current === "number" ? current : 0
    if (used >= limit) return false
    await cache.set(key, used + 1, HOUR_SECONDS)
    return true
  } catch (e) {
    // Cache caído: dejamos pasar para no romper UX, pero loggeamos.
    logger?.warn?.(`chat rate limit cache error: ${(e as Error).message}`)
    return true
  }
}

export async function POST(
  req: MedusaRequest<Body>,
  res: MedusaResponse
): Promise<void> {
  const body = req.body ?? {}
  const message = (body.message ?? "").trim()

  if (!message) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "message is required")
  }
  if (message.length > MAX_MESSAGE_LEN) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `message exceeds ${MAX_MESSAGE_LEN} chars`
    )
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const svc = req.scope.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService

  // Customer logueado (si lo hay).
  const customerId =
    (req as any).auth_context?.actor_id ||
    (req as any).user?.customer_id ||
    null

  // Rate limit. Intenta resolver módulo cache; si no está, no aplica.
  let cache: any = null
  try {
    cache = req.scope.resolve(Modules.CACHE)
  } catch {
    // sin cache → sin rate limit (dev)
  }

  if (cache) {
    const limitIp = Number(process.env.CHAT_RATE_LIMIT_PER_HOUR_IP || 20)
    const limitCust = Number(process.env.CHAT_RATE_LIMIT_PER_HOUR_CUSTOMER || 60)
    const bucket = hourBucket()
    const ip = clientIp(req)
    const limit = customerId ? limitCust : limitIp
    const key = customerId ? `chat:rl:cust:${customerId}:${bucket}` : `chat:rl:ip:${ip}:${bucket}`
    const allowed = await checkAndIncrementLimit(cache, key, limit, logger)
    if (!allowed) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Has excedido el límite de ${limit} mensajes por hora.`,
      })
      return
    }
  }

  // Resuelve o crea conversation.
  let conversationId = body.conversation_id
  if (conversationId) {
    const existing = await svc.listConversations({ id: conversationId }, { take: 1 })
    if (!existing.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Conversation ${conversationId} not found`
      )
    }
  } else {
    const [created] = await svc.createConversations([
      {
        customer_id: customerId,
        started_at: new Date(),
      },
    ])
    conversationId = created.id

    // Si hay customer logueado, crear el module link Customer ↔ Conversation.
    if (customerId) {
      try {
        const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
        await link.create({
          [Modules.CUSTOMER]: { customer_id: customerId },
          [AI_ASSISTANT_MODULE]: { conversation_id: conversationId },
        })
      } catch (e) {
        logger.warn?.(`failed to link customer→conversation: ${(e as Error).message}`)
      }
    }
  }

  const { result } = await chatRespondWorkflow(req.scope).run({
    input: { conversation_id: conversationId, user_message: message },
  })

  logger.info?.(
    `chat-respond convo=${conversationId} in=${result.input_tokens} out=${result.output_tokens}`
  )

  res.json({
    conversation_id: conversationId,
    message: result.assistant_message,
    user_message_id: result.user_message_id,
    assistant_message_id: result.assistant_message_id,
    usage: {
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    },
  })
}
