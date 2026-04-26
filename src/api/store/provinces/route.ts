import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { GEOGRAPHY_MODULE } from "../../../modules/geography";
import GeographyModuleService from "../../../modules/geography/service";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const geographyService: GeographyModuleService =
    req.scope.resolve(GEOGRAPHY_MODULE);

  const provinces = await geographyService.listProvinces(
    {},
    { order: { code: "ASC" } }
  );

  res.json({ provinces });
}
