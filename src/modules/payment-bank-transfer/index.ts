import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BankTransferPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [BankTransferPaymentProviderService],
})
