import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params.id
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
      "payment_collections.payments.amount",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
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
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Payment already captured")
  }

  const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
  await paymentModule.capturePayment({
    payment_id: payment.id,
    amount: payment.amount,
  })

  try {
    const notification = req.scope.resolve(Modules.NOTIFICATION) as any
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "bank-transfer-confirmed",
      data: {
        order_id: order.id,
        display_id: order.display_id,
        email: order.email,
        reference: (order.metadata as any)?.bank_transfer?.reference,
      },
    })
  } catch {
    // notification module not loaded; silent skip
  }

  res.json({ ok: true, payment_id: payment.id })
}
