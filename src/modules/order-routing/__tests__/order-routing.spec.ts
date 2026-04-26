import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import OrderRoutingModule, { ORDER_ROUTING_MODULE } from "../index";
import OrderRoutingModuleService from "../service";

jest.setTimeout(60000);

moduleIntegrationTestRunner<OrderRoutingModuleService>({
  moduleName: ORDER_ROUTING_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("OrderRoutingModuleService", () => {
      it("crea un routing con shipments", async () => {
        const [routing] = await service.createOrderRoutings([
          {
            order_id: "order_test_1",
            mode: "optimal",
            status: "routed",
            total_surcharge_amount: 5,
          },
        ]);

        await service.createOrderRoutingShipments([
          {
            routing_id: routing.id,
            stock_location_id: "sloc_quito",
            surcharge_amount: 0,
            items: [{ line_item_id: "li_1", variant_id: "v1", quantity: 1 }] as any,
          },
          {
            routing_id: routing.id,
            stock_location_id: "sloc_guayaquil",
            surcharge_amount: 5,
            items: [{ line_item_id: "li_2", variant_id: "v2", quantity: 1 }] as any,
          },
        ]);

        const fetched = await service.retrieveOrderRouting(routing.id, {
          relations: ["shipments"],
        });
        expect(fetched.mode).toBe("optimal");
        expect(fetched.status).toBe("routed");
        expect((fetched as any).shipments).toHaveLength(2);
      });

      it("respeta unique constraint por order_id", async () => {
        await service.createOrderRoutings([
          {
            order_id: "order_test_unique",
            mode: "unified",
            status: "routed",
            total_surcharge_amount: 0,
          },
        ]);

        await expect(
          service.createOrderRoutings([
            {
              order_id: "order_test_unique",
              mode: "unified",
              status: "routed",
              total_surcharge_amount: 0,
            },
          ])
        ).rejects.toThrow();
      });

      it("permite status requires_manual_routing sin shipments", async () => {
        const [routing] = await service.createOrderRoutings([
          {
            order_id: "order_test_manual",
            mode: "unified",
            status: "requires_manual_routing",
            total_surcharge_amount: 0,
          },
        ]);

        const fetched = await service.retrieveOrderRouting(routing.id);
        expect(fetched.status).toBe("requires_manual_routing");
      });
    });
  },
});

export {};
