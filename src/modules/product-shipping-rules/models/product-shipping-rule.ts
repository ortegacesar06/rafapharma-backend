import { model } from "@medusajs/framework/utils";

const ProductShippingRule = model.define("product_shipping_rule", {
  id: model.id().primaryKey(),
  product_id: model.text().unique(),
  requires_unified_shipment: model.boolean().default(false),
});

export default ProductShippingRule;
