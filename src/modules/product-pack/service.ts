import { MedusaService } from "@medusajs/framework/utils";
import ProductPack from "./models/product-pack";
import PackItem from "./models/pack-item";

class ProductPackModuleService extends MedusaService({
  ProductPack,
  PackItem,
}) {}

export default ProductPackModuleService;
