import GeographyModule from "../modules/geography";
import WarehouseRoutingModule from "../modules/warehouse-routing";
import { defineLink } from "@medusajs/framework/utils";

export default defineLink(
  GeographyModule.linkable.canton,
  {
    linkable: WarehouseRoutingModule.linkable.warehouseServiceArea,
    isList: true,
  }
);
