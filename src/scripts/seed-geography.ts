import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { GEOGRAPHY_MODULE } from "../modules/geography";
import GeographyModuleService from "../modules/geography/service";
import {
  PROVINCES,
  buildCantonRows,
} from "./seed-geography-data";

export default async function seedGeography({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const geographyService: GeographyModuleService =
    container.resolve(GEOGRAPHY_MODULE);

  const existingProvinces = await geographyService.listProvinces({});
  const existingProvinceCodes = new Set(existingProvinces.map((p) => p.code));
  const provincesToCreate = PROVINCES.filter(
    (p) => !existingProvinceCodes.has(p.code)
  );

  if (provincesToCreate.length > 0) {
    await geographyService.createProvinces(provincesToCreate);
    logger.info(`Seeded ${provincesToCreate.length} province(s).`);
  } else {
    logger.info(`Provinces already seeded (${existingProvinces.length}).`);
  }

  const allProvinces = await geographyService.listProvinces({});
  const provinceIdByCode = new Map(allProvinces.map((p) => [p.code, p.id]));

  const existingCantons = await geographyService.listCantons({});
  const existingCantonCodes = new Set(existingCantons.map((c) => c.code));

  const cantonRows = buildCantonRows();
  const cantonsToCreate = cantonRows
    .filter((row) => !existingCantonCodes.has(row.code))
    .map((row) => {
      const provinceId = provinceIdByCode.get(row.province_code);
      if (!provinceId) {
        throw new Error(
          `Province ${row.province_code} not found while seeding canton ${row.code}`
        );
      }
      return {
        code: row.code,
        name: row.name,
        province_id: provinceId,
      };
    });

  if (cantonsToCreate.length > 0) {
    await geographyService.createCantons(cantonsToCreate);
    logger.info(`Seeded ${cantonsToCreate.length} canton(s).`);
  } else {
    logger.info(`Cantons already seeded (${existingCantons.length}).`);
  }
}
