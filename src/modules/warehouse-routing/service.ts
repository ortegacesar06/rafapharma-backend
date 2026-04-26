import { MedusaService } from "@medusajs/framework/utils";
import WarehouseServiceArea from "./models/warehouse-service-area";

class WarehouseRoutingModuleService extends MedusaService({
  WarehouseServiceArea,
}) {}

export default WarehouseRoutingModuleService;
