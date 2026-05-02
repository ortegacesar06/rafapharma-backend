import {
  BankTransferPaymentProviderService,
  buildFinalReference,
  buildPendingReference,
  generateReferenceSuffix,
} from "../service"

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as any

const buildService = (overrides: Record<string, unknown> = {}) =>
  new BankTransferPaymentProviderService(
    { logger: noopLogger },
    {
      account_name: "Rafapharma S.A.",
      account_number: "1234567890",
      bank_name: "Banco Pichincha",
      ruc: "0999999999001",
      reference_prefix: "RP",
      ...overrides,
    } as any
  )

describe("payment-bank-transfer service", () => {
  describe("reference helpers", () => {
    it("generateReferenceSuffix produces a 6-char hex uppercase string", () => {
      const suffix = generateReferenceSuffix()
      expect(suffix).toMatch(/^[0-9A-F]{6}$/)
    })

    it("buildPendingReference / buildFinalReference compose the expected formats", () => {
      expect(buildPendingReference("RP", "ABC123")).toBe("RP-PENDING-ABC123")
      expect(buildFinalReference("RP", 42, "ABC123")).toBe("RP-42-ABC123")
      expect(buildFinalReference("FOO", "1042", "X1Y2Z3")).toBe("FOO-1042-X1Y2Z3")
    })
  })

  describe("validateOptions", () => {
    it("throws when account_number is missing", () => {
      expect(() =>
        BankTransferPaymentProviderService.validateOptions({
          account_name: "X",
          bank_name: "Y",
        })
      ).toThrow(/account_number/)
    })

    it("accepts a complete options object", () => {
      expect(() =>
        BankTransferPaymentProviderService.validateOptions({
          account_name: "X",
          account_number: "1",
          bank_name: "Y",
        })
      ).not.toThrow()
    })
  })

  describe("initiatePayment", () => {
    it("returns PENDING status with awaiting_payment data and bank account info", async () => {
      const svc = buildService()
      const out = await svc.initiatePayment({
        amount: 100,
        currency_code: "usd",
        data: {},
      } as any)

      expect(out.status).toBe("pending")
      expect(typeof out.id).toBe("string")
      const data = out.data as any
      expect(data.status).toBe("awaiting_payment")
      expect(data.proof_uploaded).toBe(false)
      expect(data.reference).toMatch(/^RP-PENDING-[0-9A-F]{6}$/)
      expect(data.reference_suffix).toMatch(/^[0-9A-F]{6}$/)
      expect(data.bank_account).toMatchObject({
        account_name: "Rafapharma S.A.",
        account_number: "1234567890",
        bank_name: "Banco Pichincha",
        ruc: "0999999999001",
      })
    })
  })

  describe("authorize/capture/cancel/refund", () => {
    const baseData = {
      reference: "RP-PENDING-ABC123",
      reference_suffix: "ABC123",
      status: "awaiting_payment" as const,
      proof_uploaded: false,
      bank_account: { account_name: "X", account_number: "1", bank_name: "Y" },
    }

    it("authorizePayment returns AUTHORIZED preserving data", async () => {
      const svc = buildService()
      const out = await svc.authorizePayment({ data: baseData } as any)
      expect(out.status).toBe("authorized")
      expect(out.data).toEqual(baseData)
    })

    it("capturePayment marks status=paid and sets captured_at", async () => {
      const svc = buildService()
      const out = await svc.capturePayment({ data: baseData } as any)
      expect((out.data as any).status).toBe("paid")
      expect(typeof (out.data as any).captured_at).toBe("string")
    })

    it("cancelPayment marks status=rejected and sets rejected_at", async () => {
      const svc = buildService()
      const out = await svc.cancelPayment({ data: baseData } as any)
      expect((out.data as any).status).toBe("rejected")
      expect(typeof (out.data as any).rejected_at).toBe("string")
    })

    it("refundPayment marks status=refunded", async () => {
      const svc = buildService()
      const out = await svc.refundPayment({ data: { ...baseData, status: "paid" } } as any)
      expect((out.data as any).status).toBe("refunded")
    })
  })

  describe("getPaymentStatus", () => {
    it("returns CAPTURED when data.status is paid", async () => {
      const svc = buildService()
      const out = await svc.getPaymentStatus({ data: { status: "paid" } } as any)
      expect(out.status).toBe("captured")
    })

    it("returns CANCELED when data.status is rejected", async () => {
      const svc = buildService()
      const out = await svc.getPaymentStatus({ data: { status: "rejected" } } as any)
      expect(out.status).toBe("canceled")
    })

    it("defaults to AUTHORIZED while waiting for proof / verification", async () => {
      const svc = buildService()
      const out = await svc.getPaymentStatus({
        data: { status: "awaiting_payment" },
      } as any)
      expect(out.status).toBe("authorized")
    })
  })

  describe("getWebhookActionAndData", () => {
    it("always reports not_supported (manual transfer has no webhooks)", async () => {
      const svc = buildService()
      const out = await svc.getWebhookActionAndData({} as any)
      expect(out.action).toBe("not_supported")
    })
  })
})
