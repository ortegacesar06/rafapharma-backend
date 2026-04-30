import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function orderPlacedEmailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  const logger = container.resolve("logger")
  const notification = container.resolve(Modules.NOTIFICATION) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "subtotal",
      "shipping_total",
      "tax_total",
      "items.id",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.address_1",
      "shipping_address.city",
      "shipping_address.province",
    ],
    filters: { id: orderId },
  })

  const order = orders?.[0]
  if (!order || !order.email) {
    logger.warn(`order-placed-email: skipping order ${orderId} (not found or missing email)`)
    return
  }

  try {
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-placed",
      data: {
        order_id: order.id,
        display_id: order.display_id,
        email: order.email,
        currency_code: order.currency_code,
        total: order.total,
        subtotal: order.subtotal,
        shipping_total: order.shipping_total,
        tax_total: order.tax_total,
        items: order.items,
        shipping_address: order.shipping_address,
      },
    })
  } catch (err) {
    logger.error(
      `order-placed-email: notification failed for order ${orderId}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
