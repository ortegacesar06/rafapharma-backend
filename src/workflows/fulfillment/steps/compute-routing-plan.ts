import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { WAREHOUSE_ROUTING_MODULE } from "../../../modules/warehouse-routing";
import type WarehouseRoutingModuleService from "../../../modules/warehouse-routing/service";
import {
  buildRoutingPlan,
  type ServiceAreaPlain,
  type VariantDataPlain,
} from "../build-routing-plan";
import type { SuggestWarehouseInput, SuggestWarehouseOutput } from "../types";

export const computeRoutingPlanStepId = "compute-routing-plan";

export const computeRoutingPlanStep = createStep(
  computeRoutingPlanStepId,
  async (
    input: SuggestWarehouseInput,
    { container }
  ): Promise<StepResponse<SuggestWarehouseOutput>> => {
    if (!input.canton_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "canton_id is required"
      );
    }
    if (!input.items?.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "items must not be empty"
      );
    }

    const warehouseRouting: WarehouseRoutingModuleService = container.resolve(
      WAREHOUSE_ROUTING_MODULE
    );
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const serviceAreasRaw = await warehouseRouting.listWarehouseServiceAreas(
      { canton_id: input.canton_id },
      { order: { priority: "ASC" } }
    );

    const serviceAreas: ServiceAreaPlain[] = serviceAreasRaw.map((sa) => ({
      stock_location_id: sa.stock_location_id,
      priority: sa.priority,
      surcharge_amount: Number(sa.surcharge_amount),
    }));

    const variantIds = Array.from(
      new Set(input.items.map((i) => i.variant_id))
    );

    const { data: variants } = await query.graph({
      entity: "variant",
      filters: { id: variantIds },
      fields: [
        "id",
        "manage_inventory",
        "product.id",
        "product.shipping_rule.requires_unified_shipment",
        "inventory_items.inventory_item_id",
        "inventory_items.required_quantity",
        "inventory_items.inventory.id",
        "inventory_items.inventory.location_levels.location_id",
        "inventory_items.inventory.location_levels.raw_stocked_quantity",
        "inventory_items.inventory.location_levels.raw_reserved_quantity",
      ],
    });

    const variantById = new Map<string, any>(
      variants.map((v: any) => [v.id, v])
    );

    const variantData: VariantDataPlain[] = input.items.map((item) => {
      const v = variantById.get(item.variant_id);
      if (!v) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Variant ${item.variant_id} not found`
        );
      }

      const inventoryLink = v.inventory_items?.[0];
      if (!inventoryLink?.inventory_item_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant ${item.variant_id} has no inventory item linked`
        );
      }

      const requiredPerUnit = Number(inventoryLink.required_quantity ?? 1);
      const requiredQuantity = requiredPerUnit * item.quantity;

      const availableByLocation: Record<string, number> = {};
      for (const level of inventoryLink.inventory?.location_levels ?? []) {
        const stocked = Number(level.raw_stocked_quantity?.value ?? 0);
        const reserved = Number(level.raw_reserved_quantity?.value ?? 0);
        availableByLocation[level.location_id] = stocked - reserved;
      }

      return {
        variant_id: item.variant_id,
        inventory_item_id: inventoryLink.inventory_item_id,
        required_quantity: requiredQuantity,
        requires_unified_shipment: Boolean(
          v.product?.shipping_rule?.requires_unified_shipment
        ),
        available_by_location: availableByLocation,
      };
    });

    const plan = buildRoutingPlan(serviceAreas, variantData, input.items);
    return new StepResponse(plan);
  }
);
