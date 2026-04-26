import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import WarehouseRoutingModule, {
  WAREHOUSE_ROUTING_MODULE,
} from "../index";
import WarehouseRoutingModuleService from "../service";

jest.setTimeout(60000);

moduleIntegrationTestRunner<WarehouseRoutingModuleService>({
  moduleName: WAREHOUSE_ROUTING_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("WarehouseRoutingModuleService", () => {
      const cantonA = "canton_test_quito";
      const cantonB = "canton_test_lago_agrio";
      const slQuito = "sloc_test_quito";
      const slGuayaquil = "sloc_test_gye";

      beforeEach(async () => {
        await service.createWarehouseServiceAreas([
          {
            stock_location_id: slQuito,
            canton_id: cantonA,
            priority: 0,
            surcharge_amount: 0,
          },
          {
            stock_location_id: slGuayaquil,
            canton_id: cantonA,
            priority: 100,
            surcharge_amount: 5,
          },
          {
            stock_location_id: slGuayaquil,
            canton_id: cantonB,
            priority: 50,
            surcharge_amount: 8,
          },
        ]);
      });

      it("dado un cantón, retorna bodegas ordenadas por prioridad asc", async () => {
        const areas = await service.listWarehouseServiceAreas(
          { canton_id: cantonA },
          { order: { priority: "ASC" } }
        );

        expect(areas).toHaveLength(2);
        expect(areas[0].stock_location_id).toBe(slQuito);
        expect(areas[0].priority).toBe(0);
        expect(Number(areas[0].surcharge_amount)).toBe(0);
        expect(areas[1].stock_location_id).toBe(slGuayaquil);
        expect(areas[1].priority).toBe(100);
        expect(Number(areas[1].surcharge_amount)).toBe(5);
      });

      it("respeta el constraint único (stock_location, canton)", async () => {
        await expect(
          service.createWarehouseServiceAreas([
            {
              stock_location_id: slQuito,
              canton_id: cantonA,
              priority: 1,
              surcharge_amount: 0,
            },
          ])
        ).rejects.toThrow();
      });

      it("filtra por stock_location_id", async () => {
        const areas = await service.listWarehouseServiceAreas({
          stock_location_id: slGuayaquil,
        });
        expect(areas).toHaveLength(2);
        const cantons = areas.map((a) => a.canton_id).sort();
        expect(cantons).toEqual([cantonA, cantonB].sort());
      });
    });
  },
});

export {};
