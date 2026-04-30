import { model } from "@medusajs/framework/utils";
import ProductPack from "./product-pack";

const PackItem = model
  .define("pack_item", {
    id: model.id().primaryKey(),
    pack: model.belongsTo(() => ProductPack, { mappedBy: "items" }),
    variant_id: model.text().index(),
    quantity: model.number().default(1),
  })
  .indexes([
    {
      on: ["pack_id", "variant_id"],
      unique: true,
    },
  ]);

export default PackItem;
