import { model } from "@medusajs/framework/utils";
import PackItem from "./pack-item";

const ProductPack = model.define("product_pack", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  items: model.hasMany(() => PackItem, { mappedBy: "pack" }),
});

export default ProductPack;
