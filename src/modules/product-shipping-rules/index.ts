import { Module } from "@medusajs/framework/utils";
import ProductShippingRulesModuleService from "./service";

export const PRODUCT_SHIPPING_RULES_MODULE = "product_shipping_rules";

export default Module(PRODUCT_SHIPPING_RULES_MODULE, {
  service: ProductShippingRulesModuleService,
});
