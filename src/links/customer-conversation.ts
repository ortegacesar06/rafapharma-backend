import CustomerModule from "@medusajs/medusa/customer"
import AiAssistantModule from "../modules/ai-assistant"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  CustomerModule.linkable.customer,
  {
    linkable: AiAssistantModule.linkable.conversation,
    isList: true,
  }
)
