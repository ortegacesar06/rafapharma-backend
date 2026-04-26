import { model } from "@medusajs/framework/utils";
import Province from "./province";

const Canton = model.define("canton", {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  name: model.text(),
  province: model.belongsTo(() => Province, { mappedBy: "cantons" }),
});

export default Canton;
