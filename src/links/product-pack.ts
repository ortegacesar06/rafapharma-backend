import ProductModule from "@medusajs/medusa/product";
import ProductPackModule from "../modules/product-pack";
import { defineLink } from "@medusajs/framework/utils";

export default defineLink(
  ProductModule.linkable.product,
  ProductPackModule.linkable.productPack
);
