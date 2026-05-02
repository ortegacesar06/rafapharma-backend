import { model } from "@medusajs/framework/utils"
import Conversation from "./conversation"

const Message = model.define("conversation_message", {
  id: model.id().primaryKey(),
  conversation: model.belongsTo(() => Conversation, { mappedBy: "messages" }),
  role: model.enum(["user", "assistant", "system"]),
  content: model.text(),
  input_tokens: model.number().nullable(),
  output_tokens: model.number().nullable(),
})

export default Message
