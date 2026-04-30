import { Module } from "@medusajs/framework/utils"
import FlashPromotionModuleService from "./service"

export const FLASH_PROMOTION_MODULE = "flash_promotion"

export default Module(FLASH_PROMOTION_MODULE, {
  service: FlashPromotionModuleService,
})
