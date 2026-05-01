import { Module } from "@medusajs/framework/utils"
import BrevoContactsModuleService, { BREVO_CONTACTS_MODULE } from "./service"

export { BREVO_CONTACTS_MODULE }

export default Module(BREVO_CONTACTS_MODULE, {
  service: BrevoContactsModuleService,
})
