import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  BREVO_CONTACTS_MODULE,
  type BrevoContactsModuleService,
} from "../modules/brevo-contacts/service"

export default async function customerBrevoSyncHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = event.data?.id
  if (!customerId) return

  const logger = container.resolve("logger")

  let contacts: BrevoContactsModuleService
  try {
    contacts = container.resolve(BREVO_CONTACTS_MODULE) as BrevoContactsModuleService
  } catch {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { id: customerId },
  })

  const customer = customers?.[0]
  if (!customer?.email) return

  const attributes: Record<string, string> = {}
  if (customer.first_name) attributes.FNAME = customer.first_name
  if (customer.last_name) attributes.LNAME = customer.last_name

  try {
    await contacts.upsertContact(customer.email, attributes)
  } catch (err) {
    logger.error(
      `customer-brevo-sync: upsert failed for customer ${customerId} (${customer.email}): ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: ["customer.created", "customer.updated"],
}
