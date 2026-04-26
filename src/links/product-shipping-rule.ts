import ProductModule from "@medusajs/medusa/product";
import ProductShippingRulesModule from "../modules/product-shipping-rules";
import { defineLink } from "@medusajs/framework/utils";

export default defineLink(
  ProductModule.linkable.product,
  ProductShippingRulesModule.linkable.productShippingRule
);
