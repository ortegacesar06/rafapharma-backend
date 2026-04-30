import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { decrementFlashUnitsWorkflow } from "../workflows/flash-promotion"
import type { FlashUnitsRequest } from "../workflows/flash-promotion/steps/decrement-flash-units"

export default async function decrementFlashUnitsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "promotions.id",
      "items.quantity",
      "items.adjustments.promotion_id",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order) return

  const requests = buildFlashRequests(order as unknown as OrderShape)
  if (!requests.length) return

  try {
    await decrementFlashUnitsWorkflow(container).run({
      input: { order_id: orderId, requests },
    })
  } catch (err) {
    logger.error(
      `decrement-flash-units failed for order ${orderId}: ${(err as Error).message}`
    )
  }
}

type OrderShape = {
  items?: Array<{ quantity?: number; adjustments?: Array<{ promotion_id?: string }> }>
  promotions?: Array<{ id: string }>
}

export function buildFlashRequests(order: OrderShape): FlashUnitsRequest[] {
  const totals = new Map<string, number>()
  for (const item of order.items ?? []) {
    const qty = Number(item.quantity ?? 0)
    if (qty <= 0) continue
    const promoIds = new Set<string>()
    for (const adj of item.adjustments ?? []) {
      if (adj?.promotion_id) promoIds.add(adj.promotion_id)
    }
    for (const id of promoIds) {
      totals.set(id, (totals.get(id) ?? 0) + qty)
    }
  }
  return Array.from(totals.entries()).map(([promotion_id, quantity]) => ({
    promotion_id,
    quantity,
  }))
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
