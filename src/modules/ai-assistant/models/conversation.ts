import { model } from "@medusajs/framework/utils"
import Message from "./message"

const Conversation = model.define("conversation", {
  id: model.id().primaryKey(),
  customer_id: model.text().nullable(),
  started_at: model.dateTime().default(new Date()),
  messages: model.hasMany(() => Message, { mappedBy: "conversation" }),
})

export default Conversation
