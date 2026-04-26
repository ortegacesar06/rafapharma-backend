import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import type { SuggestWarehouseOutput } from "../types";

export type ReplaceOrderReservationsInput = {
  order_id: string;
  plan: SuggestWarehouseOutput;
};

type CompensateData = {
  deleted_reservations: Array<{
    line_item_id: string;
    inventory_item_id: string;
    location_id: string;
    quantity: number;
  }>;
  created_reservation_ids: string[];
};

export const replaceOrderReservationsStepId = "replace-order-reservations";

export const replaceOrderReservationsStep = createStep(
  replaceOrderReservationsStepId,
  async (
    input: ReplaceOrderReservationsInput,
    { container }
  ): Promise<StepResponse<{ created: number }, CompensateData>> => {
    const inventory = container.resolve(Modules.INVENTORY);
    const locking = container.resolve(Modules.LOCKING);

    const lineItemIds = input.plan.shipments
      .flatMap((s) => s.items.map((i) => i.line_item_id))
      .filter((id): id is string => Boolean(id));

    if (!lineItemIds.length) {
      return new StepResponse(
        { created: 0 },
        { deleted_reservations: [], created_reservation_ids: [] }
      );
    }

    const existingReservations = await inventory.listReservationItems({
      line_item_id: lineItemIds,
    });

    const inventoryItemIds = Array.from(
      new Set([
        ...existingReservations.map((r) => r.inventory_item_id),
        ...input.plan.shipments.flatMap((s) =>
          s.items.map((i) => i.inventory_item_id)
        ),
      ])
    );

    const deletedSnapshot = existingReservations.map((r) => ({
      line_item_id: r.line_item_id as string,
      inventory_item_id: r.inventory_item_id,
      location_id: r.location_id,
      quantity: Number(r.quantity),
    }));

    const created = await locking.execute(inventoryItemIds, async () => {
      if (existingReservations.length) {
        await inventory.deleteReservationItems(
          existingReservations.map((r) => r.id)
        );
      }

      const toCreate = input.plan.shipments.flatMap((s) =>
        s.items
          .filter((i) => i.line_item_id)
          .map((i) => ({
            line_item_id: i.line_item_id!,
            inventory_item_id: i.inventory_item_id,
            location_id: s.stock_location_id,
            quantity: i.quantity,
          }))
      );

      return await inventory.createReservationItems(toCreate);
    });

    return new StepResponse(
      { created: created.length },
      {
        deleted_reservations: deletedSnapshot,
        created_reservation_ids: created.map((c) => c.id),
      }
    );
  },
  async (compensateData, { container }) => {
    if (!compensateData) return;
    const inventory = container.resolve(Modules.INVENTORY);
    const locking = container.resolve(Modules.LOCKING);

    const lockingKeys = Array.from(
      new Set([
        ...compensateData.deleted_reservations.map((r) => r.inventory_item_id),
      ])
    );

    await locking.execute(lockingKeys, async () => {
      if (compensateData.created_reservation_ids.length) {
        await inventory.deleteReservationItems(
          compensateData.created_reservation_ids
        );
      }
      if (compensateData.deleted_reservations.length) {
        await inventory.createReservationItems(
          compensateData.deleted_reservations
        );
      }
    });
  }
);
