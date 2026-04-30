import { Module } from "@medusajs/framework/utils";
import ProductPackModuleService from "./service";

export const PRODUCT_PACK_MODULE = "product_pack";

export default Module(PRODUCT_PACK_MODULE, {
  service: ProductPackModuleService,
});
