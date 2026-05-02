import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { buildFinalReference } from "../../../../../modules/payment-bank-transfer/service"

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
])

const REFERENCE_PREFIX = process.env.BANK_TRANSFER_REFERENCE_PREFIX || "RP"

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}
type MultipartRequest = MedusaRequest & { file?: UploadedFile }

export async function POST(req: MultipartRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params.id
  const file = req.file
  const email = (req.body as { email?: string } | undefined)?.email?.trim().toLowerCase()

  if (!file) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "file is required (multipart field 'file')")
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported mime type ${file.mimetype}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
    )
  }
  if (!email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "email is required")
  }

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
      "payment_collections.payments.data",
    ],
  })
  const order = orders?.[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${orderId} not found`)
  }
  if ((order.email ?? "").toLowerCase() !== email) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "email does not match order")
  }

  const payment = (order.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payments ?? [])
    .find((p: any) => p?.provider_id?.includes("bank-transfer"))
  if (!payment) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Order does not have a bank-transfer payment"
    )
  }

  const suffix = (payment.data as { reference_suffix?: string } | null)?.reference_suffix
  const reference = suffix && order.display_id != null
    ? buildFinalReference(REFERENCE_PREFIX, order.display_id, suffix)
    : undefined

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: `payment-proof-${order.display_id}-${Date.now()}-${file.originalname}`,
          mimeType: file.mimetype,
          content: file.buffer.toString("base64"),
          access: "private",
        },
      ],
    },
  })
  const uploaded = result?.[0]
  if (!uploaded) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "File upload failed")
  }

  const orderModule = req.scope.resolve(Modules.ORDER) as any
  const previousMetadata = (order.metadata ?? {}) as Record<string, unknown>
  const proofUploadedAt = new Date().toISOString()
  await orderModule.updateOrders({
    id: order.id,
    metadata: {
      ...previousMetadata,
      bank_transfer: {
        ...((previousMetadata.bank_transfer as Record<string, unknown> | undefined) ?? {}),
        proof_file_id: uploaded.id,
        proof_file_url: uploaded.url,
        proof_uploaded_at: proofUploadedAt,
        reference,
      },
    },
  })

  try {
    const notification = req.scope.resolve(Modules.NOTIFICATION) as any
    await notification.createNotifications({
      to: order.email,
      channel: "email",
      template: "bank-transfer-proof-received",
      data: {
        order_id: order.id,
        display_id: order.display_id,
        email: order.email,
        reference,
        proof_file_url: uploaded.url,
      },
    })
  } catch {
    // notification module may not be loaded (no BREVO_API_KEY); silent skip
  }

  res.status(200).json({
    order_id: order.id,
    proof_file_id: uploaded.id,
    proof_file_url: uploaded.url,
    proof_uploaded_at: proofUploadedAt,
    reference,
  })
}
