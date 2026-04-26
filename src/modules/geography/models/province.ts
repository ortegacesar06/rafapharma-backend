import { model } from "@medusajs/framework/utils";
import Canton from "./canton";

const Province = model.define("province", {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  name: model.text(),
  cantons: model.hasMany(() => Canton, { mappedBy: "province" }),
});

export default Province;
