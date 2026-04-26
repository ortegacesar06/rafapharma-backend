import { MedusaService } from "@medusajs/framework/utils";
import Province from "./models/province";
import Canton from "./models/canton";

class GeographyModuleService extends MedusaService({
  Province,
  Canton,
}) {}

export default GeographyModuleService;
