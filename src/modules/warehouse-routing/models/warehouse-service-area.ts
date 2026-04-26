import { model } from "@medusajs/framework/utils";

const WarehouseServiceArea = model.define("warehouse_service_area", {
  id: model.id().primaryKey(),
  stock_location_id: model.text().index(),
  canton_id: model.text().index(),
  priority: model.number().default(100),
  surcharge_amount: model.bigNumber().default(0),
}).indexes([
  {
    on: ["stock_location_id", "canton_id"],
    unique: true,
  },
]);

export default WarehouseServiceArea;
