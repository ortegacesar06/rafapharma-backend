import { BrevoNotificationProviderService } from "../service"

jest.mock("@getbrevo/brevo", () => {
  return {
    BrevoClient: jest.fn().mockImplementation(() => ({
      transactionalEmails: {
        sendTransacEmail: jest.fn(),
      },
    })),
  }
})

const makeService = (overrides: Partial<ConstructorParameters<typeof BrevoNotificationProviderService>[1]> = {}) => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any
  const options = {
    api_key: "test-key",
    from_email: "no-reply@rafapharma.ec",
    from_name: "Rafapharma",
    templates: { "order-placed": 42 },
    ...overrides,
  }
  const svc = new BrevoNotificationProviderService({ logger }, options)
  const sendMock = (svc as any).client_.transactionalEmails.sendTransacEmail as jest.Mock
  return { svc, sendMock, logger }
}

describe("BrevoNotificationProviderService", () => {
  describe("validateOptions", () => {
    it("throws when api_key is missing", () => {
      expect(() => BrevoNotificationProviderService.validateOptions({ from_email: "a@b.c" })).toThrow(/api_key/)
    })

    it("throws when from_email is missing", () => {
      expect(() => BrevoNotificationProviderService.validateOptions({ api_key: "x" })).toThrow(/from_email/)
    })

    it("passes with required options", () => {
      expect(() => BrevoNotificationProviderService.validateOptions({ api_key: "x", from_email: "a@b.c" })).not.toThrow()
    })
  })

  describe("send", () => {
    it("maps template name → numeric Brevo template id and forwards data as params", async () => {
      const { svc, sendMock } = makeService()
      sendMock.mockResolvedValueOnce({ messageId: "msg-1" })

      const res = await svc.send({
        to: "user@example.com",
        channel: "email",
        template: "order-placed",
        data: { display_id: 1234 },
      } as any)

      expect(res).toEqual({ id: "msg-1" })
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 42,
          params: { display_id: 1234 },
          to: [{ email: "user@example.com" }],
          sender: { email: "no-reply@rafapharma.ec", name: "Rafapharma" },
        })
      )
    })

    it("accepts a numeric template string when not in the map", async () => {
      const { svc, sendMock } = makeService()
      sendMock.mockResolvedValueOnce({ messageId: "msg-2" })

      await svc.send({ to: "u@e.com", channel: "email", template: "99", data: {} } as any)

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ templateId: 99 }))
    })

    it("throws when the template is unknown and not numeric", async () => {
      const { svc } = makeService()
      await expect(
        svc.send({ to: "u@e.com", channel: "email", template: "unknown", data: {} } as any)
      ).rejects.toThrow(/no Brevo template id mapped/)
    })

    it("supports multiple comma-separated recipients", async () => {
      const { svc, sendMock } = makeService()
      sendMock.mockResolvedValueOnce({ messageId: "msg-3" })

      await svc.send({
        to: "a@x.com, b@x.com",
        channel: "email",
        template: "order-placed",
        data: {},
      } as any)

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [{ email: "a@x.com" }, { email: "b@x.com" }],
        })
      )
    })

    it("uses notification.from to override the default sender email", async () => {
      const { svc, sendMock } = makeService()
      sendMock.mockResolvedValueOnce({ messageId: "msg-4" })

      await svc.send({
        to: "u@e.com",
        from: "support@rafapharma.ec",
        channel: "email",
        template: "order-placed",
        data: {},
      } as any)

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { email: "support@rafapharma.ec", name: "Rafapharma" },
        })
      )
    })

    it("throws when `to` is missing", async () => {
      const { svc } = makeService()
      await expect(
        svc.send({ channel: "email", template: "order-placed", data: {} } as any)
      ).rejects.toThrow(/`to` is required/)
    })

    it("propagates SDK errors after logging", async () => {
      const { svc, sendMock, logger } = makeService()
      sendMock.mockRejectedValueOnce(new Error("brevo down"))

      await expect(
        svc.send({ to: "u@e.com", channel: "email", template: "order-placed", data: {} } as any)
      ).rejects.toThrow("brevo down")
      expect(logger.error).toHaveBeenCalled()
    })
  })
})
