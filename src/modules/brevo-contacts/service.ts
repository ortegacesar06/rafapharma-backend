import { MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import { BrevoClient } from "@getbrevo/brevo"

export type BrevoContactsOptions = {
  api_key: string
  /** Lista de Brevo donde se sincronizan TODOS los customers nuevos (opt-in default). */
  default_list_id?: number
  /** Mapa nombre simbólico → list id de Brevo (resuelve `flash.notification_segment`). */
  segments?: Record<string, number>
}

export type ContactAttributes = Record<string, string | number | boolean | string[]>

type InjectedDependencies = {
  logger: Logger
}

type ContactsClient = {
  createContact: (req: {
    email?: string
    attributes?: ContactAttributes
    listIds?: number[]
    updateEnabled?: boolean
  }) => Promise<unknown>
  updateContact: (req: {
    identifier: string
    identifierType?: string
    attributes?: ContactAttributes
    listIds?: number[]
    unlinkListIds?: number[]
  }) => Promise<unknown>
  deleteContact: (req: { identifier: string; identifierType?: string }) => Promise<unknown>
  getContactsFromList: (req: {
    listId: number
    limit?: number
    offset?: number
  }) => Promise<{ contacts: Array<{ email?: string }>; count: number }>
  addContactToList: (req: { listId: number; emails?: string[] }) => Promise<unknown>
  removeContactFromList: (req: { listId: number; emails?: string[] }) => Promise<unknown>
}

type BrevoContactsClientShape = { contacts: ContactsClient }

export const BREVO_CONTACTS_MODULE = "brevo_contacts"

export class BrevoContactsModuleService {
  static identifier = "brevo-contacts"

  protected readonly logger_: Logger
  protected readonly options_: BrevoContactsOptions
  protected readonly client_: BrevoContactsClientShape

  constructor({ logger }: InjectedDependencies, options: BrevoContactsOptions) {
    if (!options?.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "brevo-contacts: `api_key` is required"
      )
    }
    this.logger_ = logger
    this.options_ = options
    this.client_ = new BrevoClient({ apiKey: options.api_key }) as unknown as BrevoContactsClientShape
  }

  get defaultListId(): number | undefined {
    return this.options_.default_list_id
  }

  resolveSegmentListId(segment: string | null | undefined): number | undefined {
    if (!segment) return this.options_.default_list_id
    return this.options_.segments?.[segment]
  }

  async upsertContact(
    email: string,
    attributes?: ContactAttributes,
    listIds?: number[]
  ): Promise<void> {
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "brevo-contacts: email is required")
    }
    const lists = listIds && listIds.length ? listIds : this.options_.default_list_id ? [this.options_.default_list_id] : undefined
    try {
      await this.client_.contacts.createContact({
        email,
        attributes,
        listIds: lists,
        updateEnabled: true,
      })
    } catch (err) {
      this.logger_.error(`brevo-contacts: upsert failed for ${email}: ${(err as Error).message}`)
      throw err
    }
  }

  async deleteContact(email: string): Promise<void> {
    try {
      await this.client_.contacts.deleteContact({ identifier: email, identifierType: "email_id" })
    } catch (err) {
      this.logger_.error(`brevo-contacts: delete failed for ${email}: ${(err as Error).message}`)
      throw err
    }
  }

  async addToList(email: string, listId: number): Promise<void> {
    await this.client_.contacts.addContactToList({ listId, emails: [email] })
  }

  async removeFromList(email: string, listId: number): Promise<void> {
    await this.client_.contacts.removeContactFromList({ listId, emails: [email] })
  }

  /**
   * Itera todas las páginas de la lista y devuelve emails. Brevo limita a 500 por página.
   */
  async getListContacts(listId: number): Promise<string[]> {
    const pageSize = 500
    const emails: string[] = []
    let offset = 0
    while (true) {
      const page = await this.client_.contacts.getContactsFromList({ listId, limit: pageSize, offset })
      const contacts = page?.contacts ?? []
      for (const c of contacts) {
        if (c.email) emails.push(c.email)
      }
      if (contacts.length < pageSize) break
      offset += pageSize
    }
    return emails
  }
}

export default BrevoContactsModuleService
