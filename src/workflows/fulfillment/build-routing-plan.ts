import type {
  RoutingInputItem,
  RoutingShipment,
  SuggestWarehouseOutput,
} from "./types";

export type ServiceAreaPlain = {
  stock_location_id: string;
  priority: number;
  surcharge_amount: number;
};

export type VariantDataPlain = {
  variant_id: string;
  inventory_item_id: string;
  required_quantity: number;
  requires_unified_shipment: boolean;
  /** stocked - reserved per location */
  available_by_location: Record<string, number>;
};

/**
 * Decide bodega(s) y recargo dado:
 * - service areas (ya filtradas por cantón, ordenadas por priority asc)
 * - datos por variante con disponibilidad por location
 * - items originales (para mantener line_item_id en el output)
 *
 * Reglas: D5 (unified si CUALQUIER ítem lo pide) + ordenar por priority + escalar.
 */
export function buildRoutingPlan(
  serviceAreas: ServiceAreaPlain[],
  variantData: VariantDataPlain[],
  items: RoutingInputItem[]
): SuggestWarehouseOutput {
  if (serviceAreas.length === 0) {
    return {
      mode: "optimal",
      routable: false,
      reason: "no_service_area_for_canton",
      shipments: [],
      total_surcharge_amount: 0,
    };
  }

  const sorted = [...serviceAreas].sort((a, b) => a.priority - b.priority);
  const requiresUnified = variantData.some((v) => v.requires_unified_shipment);
  const mode: "unified" | "optimal" = requiresUnified ? "unified" : "optimal";

  if (mode === "unified") {
    const chosen = sorted.find((sa) =>
      variantData.every(
        (v) =>
          (v.available_by_location[sa.stock_location_id] ?? 0) >=
          v.required_quantity
      )
    );

    if (!chosen) {
      return {
        mode,
        routable: false,
        reason: "no_warehouse_has_all_items_for_unified_shipment",
        shipments: [],
        total_surcharge_amount: 0,
      };
    }

    const shipment: RoutingShipment = {
      stock_location_id: chosen.stock_location_id,
      surcharge_amount: chosen.surcharge_amount,
      items: items.map((item, idx) => ({
        line_item_id: item.line_item_id,
        variant_id: item.variant_id,
        inventory_item_id: variantData[idx].inventory_item_id,
        quantity: variantData[idx].required_quantity,
      })),
    };

    return {
      mode,
      routable: true,
      shipments: [shipment],
      total_surcharge_amount: chosen.surcharge_amount,
    };
  }

  // optimal: greedy por ítem, agrupando por location elegida
  const shipmentsByLocation = new Map<string, RoutingShipment>();
  const unroutable: string[] = [];

  items.forEach((item, idx) => {
    const data = variantData[idx];
    const chosen = sorted.find(
      (sa) =>
        (data.available_by_location[sa.stock_location_id] ?? 0) >=
        data.required_quantity
    );

    if (!chosen) {
      unroutable.push(item.variant_id);
      return;
    }

    let bucket = shipmentsByLocation.get(chosen.stock_location_id);
    if (!bucket) {
      bucket = {
        stock_location_id: chosen.stock_location_id,
        surcharge_amount: chosen.surcharge_amount,
        items: [],
      };
      shipmentsByLocation.set(chosen.stock_location_id, bucket);
    }
    bucket.items.push({
      line_item_id: item.line_item_id,
      variant_id: item.variant_id,
      inventory_item_id: data.inventory_item_id,
      quantity: data.required_quantity,
    });
  });

  if (unroutable.length > 0) {
    return {
      mode,
      routable: false,
      reason: `no_stock_for_variants:${unroutable.join(",")}`,
      shipments: Array.from(shipmentsByLocation.values()),
      total_surcharge_amount: 0,
    };
  }

  const shipments = Array.from(shipmentsByLocation.values());
  const total = shipments.reduce((acc, s) => acc + s.surcharge_amount, 0);

  return {
    mode,
    routable: true,
    shipments,
    total_surcharge_amount: total,
  };
}
