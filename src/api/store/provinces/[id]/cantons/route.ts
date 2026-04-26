import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { GEOGRAPHY_MODULE } from "../../../../../modules/geography";
import GeographyModuleService from "../../../../../modules/geography/service";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const geographyService: GeographyModuleService =
    req.scope.resolve(GEOGRAPHY_MODULE);

  const { id } = req.params;

  const province = await geographyService.retrieveProvince(id).catch(() => null);
  if (!province) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Province ${id} not found`
    );
  }

  const cantons = await geographyService.listCantons(
    { province_id: id },
    { order: { code: "ASC" } }
  );

  res.json({ cantons });
}
