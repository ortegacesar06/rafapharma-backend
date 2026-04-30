import PromotionModule from "@medusajs/medusa/promotion"
import FlashPromotionModule from "../modules/flash-promotion"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  PromotionModule.linkable.promotion,
  FlashPromotionModule.linkable.flashPromotion
)
