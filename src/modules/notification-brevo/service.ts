import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { BrevoClient } from "@getbrevo/brevo"

export type BrevoNotificationOptions = {
  api_key: string
  from_email: string
  from_name?: string
  reply_to_email?: string
  reply_to_name?: string
  /**
   * Map of symbolic template name (used in `notification.template`) to Brevo
   * server-side numeric template id. Names not present in this map are treated
   * as raw numeric ids if the string parses as a number; otherwise an error is
   * thrown when sending.
   */
  templates?: Record<string, number>
}

type InjectedDependencies = {
  logger: Logger
}

type RecipientItem = { email: string; name?: string }

type BrevoSender = { transactionalEmails: { sendTransacEmail: (req: any) => Promise<{ messageId?: string; messageIds?: string[] }> } }

export class BrevoNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "brevo"

  protected readonly logger_: Logger
  protected readonly options_: BrevoNotificationOptions
  protected readonly client_: BrevoSender

  constructor({ logger }: InjectedDependencies, options: BrevoNotificationOptions) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = new BrevoClient({ apiKey: options.api_key }) as unknown as BrevoSender
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "notification-brevo: `api_key` is required"
      )
    }
    if (!options.from_email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "notification-brevo: `from_email` is required"
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification.to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "notification-brevo: `to` is required"
      )
    }

    const templateId = this.resolveTemplateId(notification.template)
    const to: RecipientItem[] = this.parseRecipients(notification.to)

    const sender = notification.from
      ? { email: notification.from, name: this.options_.from_name }
      : { email: this.options_.from_email, name: this.options_.from_name }

    const replyTo = this.options_.reply_to_email
      ? { email: this.options_.reply_to_email, name: this.options_.reply_to_name }
      : undefined

    const request = {
      to,
      sender,
      replyTo,
      templateId,
      params: (notification.data ?? {}) as Record<string, unknown>,
    }

    try {
      const res = await this.client_.transactionalEmails.sendTransacEmail(request)
      return { id: res.messageId }
    } catch (err) {
      const message = (err as Error).message
      this.logger_.error(`notification-brevo: send failed for template=${notification.template} to=${notification.to}: ${message}`)
      throw err
    }
  }

  protected resolveTemplateId(template: string): number {
    const mapped = this.options_.templates?.[template]
    if (typeof mapped === "number") return mapped

    const asNumber = Number(template)
    if (Number.isInteger(asNumber) && asNumber > 0) return asNumber

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `notification-brevo: no Brevo template id mapped for "${template}". Add it to options.templates.`
    )
  }

  protected parseRecipients(to: string): RecipientItem[] {
    return to
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((email) => ({ email }))
  }
}

export default BrevoNotificationProviderService
