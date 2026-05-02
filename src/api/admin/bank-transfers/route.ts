import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const status = (req.query.status as string | undefined) ?? "pending"
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "total",
      "created_at",
      "metadata",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.data",
    ],
  })

  const filtered = (orders ?? []).filter((o: any) => {
    const payment = (o.payment_collections ?? [])
      .flatMap((pc: any) => pc?.payments ?? [])
      .find((p: any) => p?.provider_id?.includes("bank-transfer"))
    if (!payment) return false
    const meta = (o.metadata ?? {}) as Record<string, any>
    const proofUploaded = !!meta?.bank_transfer?.proof_file_id
    const captured = !!payment.captured_at
    const canceled = !!payment.canceled_at
    if (status === "pending") return proofUploaded && !captured && !canceled
    if (status === "captured") return captured
    if (status === "rejected") return canceled
    if (status === "all") return true
    return false
  })

  res.json({ orders: filtered, count: filtered.length })
}
