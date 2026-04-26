import { MedusaService } from "@medusajs/framework/utils";
import OrderRouting from "./models/order-routing";
import OrderRoutingShipment from "./models/order-routing-shipment";

class OrderRoutingModuleService extends MedusaService({
  OrderRouting,
  OrderRoutingShipment,
}) {}

export default OrderRoutingModuleService;
