import { MedusaService } from "@medusajs/framework/utils";
import ProductShippingRule from "./models/product-shipping-rule";

class ProductShippingRulesModuleService extends MedusaService({
  ProductShippingRule,
}) {}

export default ProductShippingRulesModuleService;
