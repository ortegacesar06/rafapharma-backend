import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

type Body = { reason?: string }

export async function POST(
  req: MedusaRequest<Body>,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params.id
  const reason = req.body?.reason?.trim()
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "email",
      "metadata",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
  })
  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  const payment = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .find((p: any) => p?.provider_id?.includes("bank-transfer"))
  if (!payment) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Order has no bank-transfer payment")
  }
  if (payment.captured_at) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment already captured, cannot reject")
  }
  if (payment.canceled_at) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment already canceled")
  }

  const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
  await paymentModule.cancelPayment(payment.id)

  if (reason) {
    const orderModule = req.scope.resolve(Modules.ORDER) as any
    const previousMetadata = (order.metadata ?? {}) as Record<string, unknown>
    await orderModule.updateOrders({
      id: order.id,
      metadata: {
        ...previousMetadata,
        bank_transfer: {
          ...((previousMetadata.bank_transfer as Record<string, unknown> | undefined) ?? {}),
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
        },
      },
    })
  }

  try {
    const notification = req.scope.resolve(Modules.NOTIFICATION) as any
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "bank-transfer-rejected",
      data: {
        order_id: order.id,
        display_id: order.display_id,
        email: order.email,
        reference: (order.metadata as any)?.bank_transfer?.reference,
        reason,
      },
    })
  } catch {
    // notification module not loaded; silent skip
  }

  res.json({ ok: true, payment_id: payment.id })
}
