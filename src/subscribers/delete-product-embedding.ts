import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { AI_ASSISTANT_MODULE } from "../modules/ai-assistant"
import type AiAssistantModuleService from "../modules/ai-assistant/service"

export default async function deleteProductEmbeddingHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data?.id
  if (!productId) return
  const svc = container.resolve(AI_ASSISTANT_MODULE) as AiAssistantModuleService
  try {
    await svc.deleteProductEmbedding(productId)
  } catch (err) {
    container.resolve("logger").error?.(
      `delete-product-embedding failed for ${productId}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "product.deleted",
}
