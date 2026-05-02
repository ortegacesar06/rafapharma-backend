import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AI_ASSISTANT_MODULE } from "../../modules/ai-assistant"
import type AiAssistantModuleService from "../../modules/ai-assistant/service"
import { buildProductSourceText, voyageEmbed } from "../../modules/ai-assistant/voyage"

export type EmbedProductInput = { product_id: string }

const loadProductStep = createStep(
  "load-product-for-embedding",
  async (
    { product_id }: EmbedProductInput,
    { container }
  ): Promise<StepResponse<{ source_text: string }>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: [
        "id",
        "title",
        "subtitle",
        "description",
        "handle",
        "type.value",
        "tags.value",
        "categories.name",
      ],
    })
    const product = data?.[0]
    const source_text = product ? buildProductSourceText(product as any) : ""
    return new StepResponse({ source_text })
  }
)

const embedAndPersistStep = createStep(
  "embed-and-persist",
  async (
    args: { product_id: string; source_text: string },
    { container }
  ): Promise<StepResponse<{ persisted: boolean }>> => {
    if (!args.source_text) return new StepResponse({ persisted: false })

    const apiKey = process.env.VOYAGE_API_KEY
    const model = process.env.VOYAGE_MODEL || "voyage-3-lite"
    if (!apiKey) {
      // Sin credencial no podemos embedder; no es error duro (dev/test).
      return new StepResponse({ persisted: false })
    }

    const { embeddings } = await voyageEmbed({
      texts: [args.source_text],
      model,
      apiKey,
      inputType: "document",
    })

    const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
    await svc.upsertProductEmbedding({
      product_id: args.product_id,
      embedding: embeddings[0],
      embedding_model: model,
      source_text: args.source_text,
    })
    return new StepResponse({ persisted: true })
  }
)

export const embedProductWorkflow = createWorkflow(
  "embed-product",
  (input: EmbedProductInput) => {
    const loaded = loadProductStep(input)
    const result = embedAndPersistStep({
      product_id: input.product_id,
      source_text: loaded.source_text,
    })
    return new WorkflowResponse(result)
  }
)
