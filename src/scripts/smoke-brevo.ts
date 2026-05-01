import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  BREVO_CONTACTS_MODULE,
  type BrevoContactsModuleService,
} from "../modules/brevo-contacts/service"

/**
 * Smoke test manual contra Brevo real.
 *
 * Uso:
 *   TEST_EMAIL=tu@email.com npx medusa exec ./src/scripts/smoke-brevo.ts
 *
 * Requiere `.env` con BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_TEMPLATE_ORDER_PLACED y
 * (opcional) BREVO_DEFAULT_LIST_ID. Envía 1 email transaccional + hace upsert del contacto.
 */
export default async function smokeBrevo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const to = process.env.TEST_EMAIL
  if (!to) {
    logger.error("smoke-brevo: setea TEST_EMAIL=<email> antes de correr el script")
    return
  }

  let notification: any
  try {
    notification = container.resolve(Modules.NOTIFICATION)
  } catch {
    logger.error("smoke-brevo: módulo de notificación no cargado (BREVO_API_KEY no seteado?)")
    return
  }

  logger.info(`smoke-brevo: enviando email de prueba (template=order-placed) a ${to}`)
  try {
    const res = await notification.createNotifications({
      to,
      channel: "email",
      template: "order-placed",
      data: {
        display_id: 9999,
        email: to,
        currency_code: "USD",
        total: 0,
        items: [],
        shipping_address: { first_name: "Test", last_name: "Smoke" },
      },
    })
    logger.info(`smoke-brevo: email enviado (notification id=${res?.[0]?.id ?? "?"})`)
  } catch (err) {
    logger.error(`smoke-brevo: send falló: ${(err as Error).message}`)
  }

  let contacts: BrevoContactsModuleService
  try {
    contacts = container.resolve(BREVO_CONTACTS_MODULE) as BrevoContactsModuleService
  } catch {
    logger.warn("smoke-brevo: módulo brevo-contacts no cargado; omito sync de contacto")
    return
  }

  try {
    await contacts.upsertContact(to, { FNAME: "Smoke", LNAME: "Test" })
    logger.info(`smoke-brevo: contacto ${to} upserted en lista default`)
  } catch (err) {
    logger.error(`smoke-brevo: upsertContact falló: ${(err as Error).message}`)
  }

  if (contacts.defaultListId) {
    try {
      const emails = await contacts.getListContacts(contacts.defaultListId)
      logger.info(
        `smoke-brevo: lista ${contacts.defaultListId} tiene ${emails.length} contactos (incluye ${to}=${emails.includes(to)})`
      )
    } catch (err) {
      logger.error(`smoke-brevo: getListContacts falló: ${(err as Error).message}`)
    }
  }
}
