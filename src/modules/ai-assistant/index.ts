import { Module } from "@medusajs/framework/utils"
import AiAssistantModuleService from "./service"

export const AI_ASSISTANT_MODULE = "ai_assistant"

export default Module(AI_ASSISTANT_MODULE, {
  service: AiAssistantModuleService,
})
