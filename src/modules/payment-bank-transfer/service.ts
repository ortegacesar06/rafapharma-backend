import crypto from "crypto"
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

export type BankTransferPaymentOptions = {
  account_name: string
  account_number: string
  bank_name: string
  ruc?: string
  reference_prefix?: string
}

type InjectedDependencies = {
  logger: Logger
}

type BankTransferStatus =
  | "awaiting_payment"
  | "proof_uploaded"
  | "paid"
  | "rejected"
  | "refunded"

export type BankTransferPaymentData = {
  reference: string
  reference_suffix: string
  status: BankTransferStatus
  proof_uploaded: boolean
  bank_account: {
    account_name: string
    account_number: string
    bank_name: string
    ruc?: string
  }
  proof_file_id?: string
  proof_uploaded_at?: string
  captured_at?: string
  rejected_at?: string
  rejection_reason?: string
}

const REFERENCE_SUFFIX_BYTES = 3

export const generateReferenceSuffix = (): string =>
  crypto.randomBytes(REFERENCE_SUFFIX_BYTES).toString("hex").toUpperCase()

export const buildPendingReference = (
  prefix: string,
  suffix: string
): string => `${prefix}-PENDING-${suffix}`

export const buildFinalReference = (
  prefix: string,
  displayId: number | string,
  suffix: string
): string => `${prefix}-${displayId}-${suffix}`

export class BankTransferPaymentProviderService extends AbstractPaymentProvider<BankTransferPaymentOptions> {
  static identifier = "bank-transfer"

  protected readonly logger_: Logger
  protected readonly options_: BankTransferPaymentOptions

  constructor({ logger }: InjectedDependencies, options: BankTransferPaymentOptions) {
    super({ logger } as Record<string, unknown>, options)
    this.logger_ = logger
    this.options_ = options
  }

  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ["account_name", "account_number", "bank_name"] as const) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `payment-bank-transfer: \`${key}\` is required`
        )
      }
    }
  }

  private prefix(): string {
    return this.options_.reference_prefix ?? "RP"
  }

  private bankAccount() {
    return {
      account_name: this.options_.account_name,
      account_number: this.options_.account_number,
      bank_name: this.options_.bank_name,
      ruc: this.options_.ruc,
    }
  }

  async initiatePayment(_input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const suffix = generateReferenceSuffix()
    const data: BankTransferPaymentData = {
      reference: buildPendingReference(this.prefix(), suffix),
      reference_suffix: suffix,
      status: "awaiting_payment",
      proof_uploaded: false,
      bank_account: this.bankAccount(),
    }
    return {
      id: crypto.randomUUID(),
      data: data as unknown as Record<string, unknown>,
      status: PaymentSessionStatus.PENDING,
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return {
      data: (input.data ?? {}) as Record<string, unknown>,
      status: PaymentSessionStatus.AUTHORIZED,
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Partial<BankTransferPaymentData>
    return {
      data: {
        ...data,
        status: "paid",
        captured_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Partial<BankTransferPaymentData>
    return {
      data: {
        ...data,
        status: "rejected",
        rejected_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Partial<BankTransferPaymentData>
    return {
      data: { ...data, status: "refunded" } as unknown as Record<string, unknown>,
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: (input.data ?? {}) as Record<string, unknown> }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return (input.data ?? {}) as Record<string, unknown>
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: (input.data ?? {}) as Record<string, unknown> }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = (input.data ?? {}) as Partial<BankTransferPaymentData>
    if (data.status === "paid") {
      return { status: PaymentSessionStatus.CAPTURED, data: data as Record<string, unknown> }
    }
    if (data.status === "rejected") {
      return { status: PaymentSessionStatus.CANCELED, data: data as Record<string, unknown> }
    }
    return { status: PaymentSessionStatus.AUTHORIZED, data: data as Record<string, unknown> }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default BankTransferPaymentProviderService
