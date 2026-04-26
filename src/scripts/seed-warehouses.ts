import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStockLocationsWorkflow } from "@medusajs/medusa/core-flows";
import { GEOGRAPHY_MODULE } from "../modules/geography";
import GeographyModuleService from "../modules/geography/service";
import { WAREHOUSE_ROUTING_MODULE } from "../modules/warehouse-routing";
import WarehouseRoutingModuleService from "../modules/warehouse-routing/service";

const WAREHOUSES: {
  name: string;
  province_code: string;
  surcharge_outside: number;
}[] = [
  { name: "Bodega Quito", province_code: "17", surcharge_outside: 5 },
  { name: "Bodega Guayaquil", province_code: "09", surcharge_outside: 5 },
];

export default async function seedWarehouses({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const geography: GeographyModuleService = container.resolve(GEOGRAPHY_MODULE);
  const routing: WarehouseRoutingModuleService = container.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  const allCantons = await geography.listCantons({});
  if (allCantons.length === 0) {
    throw new Error(
      "No cantons found. Run `npx medusa exec ./src/scripts/seed-geography.ts` first."
    );
  }

  for (const wh of WAREHOUSES) {
    const existing = await stockLocationService.listStockLocations({
      name: wh.name,
    });
    let locationId: string;

    if (existing.length > 0) {
      locationId = existing[0].id;
      logger.info(`Stock location "${wh.name}" already exists (${locationId}).`);
    } else {
      const { result } = await createStockLocationsWorkflow(container).run({
        input: {
          locations: [
            { name: wh.name, address: { country_code: "ec", address_1: wh.name } },
          ],
        },
      });
      locationId = result[0].id;
      logger.info(`Created stock location "${wh.name}" (${locationId}).`);
    }

    const existingAreas = await routing.listWarehouseServiceAreas({
      stock_location_id: locationId,
    });
    const existingCantonIds = new Set(existingAreas.map((a) => a.canton_id));

    const toCreate = allCantons
      .filter((c) => !existingCantonIds.has(c.id))
      .map((c) => {
        const isLocal = c.code.startsWith(wh.province_code);
        return {
          stock_location_id: locationId,
          canton_id: c.id,
          priority: isLocal ? 0 : 100,
          surcharge_amount: isLocal ? 0 : wh.surcharge_outside,
        };
      });

    if (toCreate.length > 0) {
      await routing.createWarehouseServiceAreas(toCreate);
      logger.info(
        `Seeded ${toCreate.length} service area(s) for ${wh.name}.`
      );
    } else {
      logger.info(`Service areas for ${wh.name} already seeded.`);
    }
  }

  logger.info("Warehouses seed complete.");
}
