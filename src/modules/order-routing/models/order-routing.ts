import { model } from "@medusajs/framework/utils";
import OrderRoutingShipment from "./order-routing-shipment";

const OrderRouting = model.define("order_routing", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  mode: model.enum(["unified", "optimal"]),
  status: model.enum(["routed", "requires_manual_routing"]).default("routed"),
  total_surcharge_amount: model.bigNumber().default(0),
  shipments: model.hasMany(() => OrderRoutingShipment, { mappedBy: "routing" }),
});

export default OrderRouting;
