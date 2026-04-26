import { model } from "@medusajs/framework/utils";
import OrderRouting from "./order-routing";

const OrderRoutingShipment = model.define("order_routing_shipment", {
  id: model.id().primaryKey(),
  routing: model.belongsTo(() => OrderRouting, { mappedBy: "shipments" }),
  stock_location_id: model.text().index(),
  surcharge_amount: model.bigNumber().default(0),
  items: model.json(),
});

export default OrderRoutingShipment;
