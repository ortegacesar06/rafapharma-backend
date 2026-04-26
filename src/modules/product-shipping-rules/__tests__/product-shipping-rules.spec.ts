import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import ProductShippingRulesModule, {
  PRODUCT_SHIPPING_RULES_MODULE,
} from "../index";
import ProductShippingRulesModuleService from "../service";

jest.setTimeout(60000);

moduleIntegrationTestRunner<ProductShippingRulesModuleService>({
  moduleName: PRODUCT_SHIPPING_RULES_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("ProductShippingRulesModuleService", () => {
      it("crea una regla con el flag por defecto en false", async () => {
        const [rule] = await service.createProductShippingRules([
          { product_id: "prod_test_default" },
        ]);

        expect(rule.product_id).toBe("prod_test_default");
        expect(rule.requires_unified_shipment).toBe(false);
      });

      it("persiste requires_unified_shipment=true", async () => {
        const [rule] = await service.createProductShippingRules([
          {
            product_id: "prod_test_unified",
            requires_unified_shipment: true,
          },
        ]);

        const fetched = await service.retrieveProductShippingRule(rule.id);
        expect(fetched.requires_unified_shipment).toBe(true);
      });

      it("respeta el constraint único por product_id", async () => {
        await service.createProductShippingRules([
          { product_id: "prod_test_unique" },
        ]);

        await expect(
          service.createProductShippingRules([
            { product_id: "prod_test_unique" },
          ])
        ).rejects.toThrow();
      });

      it("permite alternar el flag con update", async () => {
        const [rule] = await service.createProductShippingRules([
          { product_id: "prod_test_toggle" },
        ]);

        await service.updateProductShippingRules({
          selector: { id: rule.id },
          data: { requires_unified_shipment: true },
        });

        const after = await service.retrieveProductShippingRule(rule.id);
        expect(after.requires_unified_shipment).toBe(true);
      });
    });
  },
});

export {};
