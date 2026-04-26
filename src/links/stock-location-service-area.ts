import StockLocationModule from "@medusajs/medusa/stock-location";
import WarehouseRoutingModule from "../modules/warehouse-routing";
import { defineLink } from "@medusajs/framework/utils";

export default defineLink(
  StockLocationModule.linkable.stockLocation,
  {
    linkable: WarehouseRoutingModule.linkable.warehouseServiceArea,
    isList: true,
  }
);
