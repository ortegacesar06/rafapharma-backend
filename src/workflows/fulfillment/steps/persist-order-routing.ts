import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { ORDER_ROUTING_MODULE } from "../../../modules/order-routing";
import type OrderRoutingModuleService from "../../../modules/order-routing/service";
import type { SuggestWarehouseOutput } from "../types";

export type PersistOrderRoutingInput = {
  order_id: string;
  plan: SuggestWarehouseOutput;
};

export const persistOrderRoutingStepId = "persist-order-routing";

export const persistOrderRoutingStep = createStep(
  persistOrderRoutingStepId,
  async (
    input: PersistOrderRoutingInput,
    { container }
  ): Promise<StepResponse<{ order_routing_id: string }, { order_routing_id: string } | null>> => {
    const service: OrderRoutingModuleService = container.resolve(
      ORDER_ROUTING_MODULE
    );
    const link = container.resolve(ContainerRegistrationKeys.LINK);

    const existing = await service.listOrderRoutings({
      order_id: input.order_id,
    });
    if (existing.length > 0) {
      // Idempotente: si ya hay routing para esta orden, no hacer nada.
      return new StepResponse({ order_routing_id: existing[0].id }, null);
    }

    const status = input.plan.routable ? "routed" : "requires_manual_routing";

    const [routing] = await service.createOrderRoutings([
      {
        order_id: input.order_id,
        mode: input.plan.mode,
        status,
        total_surcharge_amount: input.plan.total_surcharge_amount,
      },
    ]);

    if (input.plan.shipments.length) {
      await service.createOrderRoutingShipments(
        input.plan.shipments.map((s) => ({
          routing_id: routing.id,
          stock_location_id: s.stock_location_id,
          surcharge_amount: s.surcharge_amount,
          items: s.items as unknown as Record<string, unknown>,
        }))
      );
    }

    await link.create({
      [Modules.ORDER]: { order_id: input.order_id },
      [ORDER_ROUTING_MODULE]: { order_routing_id: routing.id },
    });

    return new StepResponse(
      { order_routing_id: routing.id },
      { order_routing_id: routing.id }
    );
  },
  async (compensateData, { container }) => {
    if (!compensateData) return;
    const service: OrderRoutingModuleService = container.resolve(
      ORDER_ROUTING_MODULE
    );
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    await link.dismiss({
      [Modules.ORDER]: { order_id: compensateData.order_routing_id },
      [ORDER_ROUTING_MODULE]: { order_routing_id: compensateData.order_routing_id },
    });
    await service.deleteOrderRoutings([compensateData.order_routing_id]);
  }
);
