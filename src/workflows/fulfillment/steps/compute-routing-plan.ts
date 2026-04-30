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
import {
  expandPackItems,
  type PackComponent,
} from "../expand-pack-items";
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

    const inputVariantIds = Array.from(
      new Set(input.items.map((i) => i.variant_id))
    );

    // 1) Resolve which input variants belong to a pack (Product → ProductPack → items).
    const { data: packLookup } = await query.graph({
      entity: "variant",
      filters: { id: inputVariantIds },
      fields: [
        "id",
        "product.product_pack.id",
        "product.product_pack.items.variant_id",
        "product.product_pack.items.quantity",
      ],
    });

    const packComponentsByVariantId = new Map<string, PackComponent[]>();
    for (const v of packLookup as any[]) {
      const pack = v.product?.product_pack;
      if (!pack || !Array.isArray(pack.items) || pack.items.length === 0) {
        continue;
      }
      packComponentsByVariantId.set(
        v.id,
        pack.items.map((it: any) => ({
          variant_id: it.variant_id,
          quantity: Number(it.quantity),
        }))
      );
    }

    const { expandedItems, fromPackVariantIds, hasPacks } = expandPackItems({
      items: input.items,
      packComponentsByVariantId,
    });

    // 2) Resolve inventory + shipping rule for the EXPANDED variant set.
    const expandedVariantIds = Array.from(
      new Set(expandedItems.map((i) => i.variant_id))
    );

    const { data: variants } = await query.graph({
      entity: "variant",
      filters: { id: expandedVariantIds },
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

    const variantData: VariantDataPlain[] = expandedItems.map((item) => {
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

      // D5 + Fase 5: si hay packs en la orden, fuerza unified para todos.
      const requiresUnified =
        hasPacks ||
        fromPackVariantIds.has(item.variant_id) ||
        Boolean(v.product?.shipping_rule?.requires_unified_shipment);

      return {
        variant_id: item.variant_id,
        inventory_item_id: inventoryLink.inventory_item_id,
        required_quantity: requiredQuantity,
        requires_unified_shipment: requiresUnified,
        available_by_location: availableByLocation,
      };
    });

    const plan = buildRoutingPlan(serviceAreas, variantData, expandedItems);
    return new StepResponse(plan);
  }
);
