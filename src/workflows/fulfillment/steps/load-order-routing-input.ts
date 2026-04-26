import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import type { SuggestWarehouseInput } from "../types";

export type LoadOrderRoutingInputStepInput = { order_id: string };

export const loadOrderRoutingInputStepId = "load-order-routing-input";

export const loadOrderRoutingInputStep = createStep(
  loadOrderRoutingInputStepId,
  async (
    { order_id }: LoadOrderRoutingInputStepInput,
    { container }
  ): Promise<StepResponse<SuggestWarehouseInput>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const { data } = await query.graph({
      entity: "order",
      filters: { id: order_id },
      fields: [
        "id",
        "shipping_address.metadata",
        "items.id",
        "items.variant_id",
        "items.quantity",
      ],
    });

    const order = data?.[0];
    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order ${order_id} not found`
      );
    }

    const cantonId = (order.shipping_address?.metadata as any)?.canton_id;
    if (!cantonId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order ${order_id} shipping_address.metadata.canton_id missing`
      );
    }

    const items = (order.items ?? [])
      .filter((i: any) => i.variant_id)
      .map((i: any) => ({
        line_item_id: i.id,
        variant_id: i.variant_id as string,
        quantity: Number(i.quantity),
      }));

    return new StepResponse({ canton_id: cantonId, items });
  }
);
