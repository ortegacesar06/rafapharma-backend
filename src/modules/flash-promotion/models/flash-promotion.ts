import { model } from "@medusajs/framework/utils"

const FlashPromotion = model.define("flash_promotion", {
  id: model.id().primaryKey(),
  promotion_id: model.text().unique(),
  units_limit: model.number().nullable(),
  units_sold: model.number().default(0),
  notify_on_activate: model.boolean().default(false),
  notification_segment: model.text().nullable(),
  notified_at: model.dateTime().nullable(),
})

export default FlashPromotion
