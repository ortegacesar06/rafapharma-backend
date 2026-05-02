import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { buildFinalReference } from "../modules/payment-bank-transfer/service"

const REFERENCE_PREFIX = process.env.BANK_TRANSFER_REFERENCE_PREFIX || "RP"

export default async function bankTransferInstructionsHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  if (!orderId) return

  const logger = container.resolve("logger")

  let notification: any
  try {
    notification = container.resolve(Modules.NOTIFICATION)
  } catch {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "metadata",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.data",
    ],
  })
  const order = orders?.[0]
  if (!order || !order.email) return

  const payment = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .find((p: any) => p?.provider_id?.includes("bank-transfer"))
  if (!payment) return

  const paymentData = (payment.data ?? {}) as {
    reference_suffix?: string
    bank_account?: Record<string, string>
  }
  const suffix = paymentData.reference_suffix
  if (!suffix || order.display_id == null) return
  const reference = buildFinalReference(REFERENCE_PREFIX, order.display_id, suffix)

  const orderModule = container.resolve(Modules.ORDER) as any
  const previousMetadata = (order.metadata ?? {}) as Record<string, unknown>
  await orderModule.updateOrders({
    id: order.id,
    metadata: {
      ...previousMetadata,
      bank_transfer: {
        ...((previousMetadata.bank_transfer as Record<string, unknown> | undefined) ?? {}),
        reference,
      },
    },
  })

  try {
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "bank-transfer-instructions",
      data: {
        order_id: order.id,
        display_id: order.display_id,
        email: order.email,
        currency_code: order.currency_code,
        total: order.total,
        reference,
        bank_account: paymentData.bank_account,
      },
    })
  } catch (err) {
    logger.error(
      `bank-transfer-instructions: notification failed for order ${orderId}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
