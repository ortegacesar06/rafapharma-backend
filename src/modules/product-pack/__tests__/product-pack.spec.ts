import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import ProductPackModule, { PRODUCT_PACK_MODULE } from "../index";
import ProductPackModuleService from "../service";

jest.setTimeout(60000);

moduleIntegrationTestRunner<ProductPackModuleService>({
  moduleName: PRODUCT_PACK_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("ProductPackModuleService", () => {
      it("crea un pack con items y los recupera vía relations", async () => {
        const [pack] = await service.createProductPacks([
          { product_id: "prod_pack_a" },
        ]);

        await service.createPackItems([
          { pack_id: pack.id, variant_id: "var_a1", quantity: 2 },
          { pack_id: pack.id, variant_id: "var_a2", quantity: 3 },
        ]);

        const [refreshed] = await service.listProductPacks(
          { id: pack.id },
          { relations: ["items"] }
        );

        expect(refreshed.items).toHaveLength(2);
        const byVariant = Object.fromEntries(
          refreshed.items.map((i) => [i.variant_id, i.quantity])
        );
        expect(byVariant).toEqual({ var_a1: 2, var_a2: 3 });
      });

      it("respeta el constraint único por product_id", async () => {
        await service.createProductPacks([{ product_id: "prod_pack_unique" }]);

        await expect(
          service.createProductPacks([{ product_id: "prod_pack_unique" }])
        ).rejects.toThrow();
      });

      it("respeta el constraint único (pack_id, variant_id)", async () => {
        const [pack] = await service.createProductPacks([
          { product_id: "prod_pack_dup_item" },
        ]);

        await service.createPackItems([
          { pack_id: pack.id, variant_id: "var_dup", quantity: 1 },
        ]);

        await expect(
          service.createPackItems([
            { pack_id: pack.id, variant_id: "var_dup", quantity: 5 },
          ])
        ).rejects.toThrow();
      });

      it("permite reemplazar la lista de items (delete + create)", async () => {
        const [pack] = await service.createProductPacks([
          { product_id: "prod_pack_replace" },
        ]);
        const [item1, item2] = await service.createPackItems([
          { pack_id: pack.id, variant_id: "var_old1", quantity: 1 },
          { pack_id: pack.id, variant_id: "var_old2", quantity: 1 },
        ]);

        await service.deletePackItems([item1.id, item2.id]);
        await service.createPackItems([
          { pack_id: pack.id, variant_id: "var_new", quantity: 4 },
        ]);

        const items = await service.listPackItems({ pack_id: pack.id });
        expect(items).toHaveLength(1);
        expect(items[0].variant_id).toBe("var_new");
        expect(items[0].quantity).toBe(4);
      });
    });
  },
});

export {};
