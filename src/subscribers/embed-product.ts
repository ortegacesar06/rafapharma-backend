import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { embedProductWorkflow } from "../workflows/ai-assistant/embed-product"

export default async function embedProductHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data?.id
  if (!productId) return
  if (!process.env.VOYAGE_API_KEY) return // sin credencial, no embebemos

  const logger = container.resolve("logger")
  try {
    await embedProductWorkflow(container).run({ input: { product_id: productId } })
  } catch (err) {
    logger.error(
      `embed-product: failed for ${productId}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
