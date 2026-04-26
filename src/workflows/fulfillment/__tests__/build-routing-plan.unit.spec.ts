import {
  buildRoutingPlan,
  type ServiceAreaPlain,
  type VariantDataPlain,
} from "../build-routing-plan";
import type { RoutingInputItem } from "../types";

const QUITO = "sloc_quito";
const GUAYAQUIL = "sloc_guayaquil";

// Service areas para un cantón cualquiera de Pichincha:
// Quito local (priority 0, sin recargo), Guayaquil lejano (priority 100, $5).
const serviceAreas: ServiceAreaPlain[] = [
  { stock_location_id: QUITO, priority: 0, surcharge_amount: 0 },
  { stock_location_id: GUAYAQUIL, priority: 100, surcharge_amount: 5 },
];

function variant(
  variantId: string,
  inventoryItemId: string,
  requiredQuantity: number,
  available: Record<string, number>,
  requiresUnified = false
): VariantDataPlain {
  return {
    variant_id: variantId,
    inventory_item_id: inventoryItemId,
    required_quantity: requiredQuantity,
    requires_unified_shipment: requiresUnified,
    available_by_location: available,
  };
}

function item(variantId: string, quantity = 1): RoutingInputItem {
  return { line_item_id: `li_${variantId}`, variant_id: variantId, quantity };
}

describe("buildRoutingPlan", () => {
  it("4.4-T1: sin flag, todo en stock local → 1 shipment, sin recargo", () => {
    const items = [item("v1"), item("v2")];
    const variantData = [
      variant("v1", "ii1", 1, { [QUITO]: 10, [GUAYAQUIL]: 10 }),
      variant("v2", "ii2", 1, { [QUITO]: 10, [GUAYAQUIL]: 10 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);

    expect(plan.routable).toBe(true);
    expect(plan.mode).toBe("optimal");
    expect(plan.shipments).toHaveLength(1);
    expect(plan.shipments[0].stock_location_id).toBe(QUITO);
    expect(plan.shipments[0].surcharge_amount).toBe(0);
    expect(plan.total_surcharge_amount).toBe(0);
    expect(plan.shipments[0].items.map((i) => i.variant_id).sort()).toEqual([
      "v1",
      "v2",
    ]);
  });

  it("4.4-T2: sin flag, parte en bodega lejana → 2 shipments, recargo en la lejana", () => {
    const items = [item("v1"), item("v2")];
    const variantData = [
      variant("v1", "ii1", 1, { [QUITO]: 10, [GUAYAQUIL]: 10 }),
      variant("v2", "ii2", 1, { [QUITO]: 0, [GUAYAQUIL]: 10 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);

    expect(plan.routable).toBe(true);
    expect(plan.mode).toBe("optimal");
    expect(plan.shipments).toHaveLength(2);
    expect(plan.total_surcharge_amount).toBe(5);

    const quitoShipment = plan.shipments.find(
      (s) => s.stock_location_id === QUITO
    );
    const guayaquilShipment = plan.shipments.find(
      (s) => s.stock_location_id === GUAYAQUIL
    );
    expect(quitoShipment?.items.map((i) => i.variant_id)).toEqual(["v1"]);
    expect(quitoShipment?.surcharge_amount).toBe(0);
    expect(guayaquilShipment?.items.map((i) => i.variant_id)).toEqual(["v2"]);
    expect(guayaquilShipment?.surcharge_amount).toBe(5);
  });

  it("4.4-T3: con flag y bodega local sin todo → 1 shipment desde lejana con recargo", () => {
    const items = [item("v1"), item("v2")];
    const variantData = [
      variant("v1", "ii1", 1, { [QUITO]: 10, [GUAYAQUIL]: 10 }, true),
      variant("v2", "ii2", 1, { [QUITO]: 0, [GUAYAQUIL]: 10 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);

    expect(plan.routable).toBe(true);
    expect(plan.mode).toBe("unified");
    expect(plan.shipments).toHaveLength(1);
    expect(plan.shipments[0].stock_location_id).toBe(GUAYAQUIL);
    expect(plan.shipments[0].surcharge_amount).toBe(5);
    expect(plan.total_surcharge_amount).toBe(5);
    expect(
      plan.shipments[0].items.map((i) => i.variant_id).sort()
    ).toEqual(["v1", "v2"]);
  });

  it("4.4-T4: con flag y ninguna bodega completa → routable=false (manual_routing)", () => {
    const items = [item("v1"), item("v2")];
    const variantData = [
      variant("v1", "ii1", 1, { [QUITO]: 10, [GUAYAQUIL]: 0 }, true),
      variant("v2", "ii2", 1, { [QUITO]: 0, [GUAYAQUIL]: 10 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);

    expect(plan.routable).toBe(false);
    expect(plan.mode).toBe("unified");
    expect(plan.reason).toBe("no_warehouse_has_all_items_for_unified_shipment");
    expect(plan.shipments).toHaveLength(0);
    expect(plan.total_surcharge_amount).toBe(0);
  });

  it("respeta prioridad: bodega lejana con stock vs local sin stock", () => {
    const items = [item("v1")];
    const variantData = [variant("v1", "ii1", 1, { [QUITO]: 0, [GUAYAQUIL]: 5 })];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);
    expect(plan.shipments[0].stock_location_id).toBe(GUAYAQUIL);
    expect(plan.total_surcharge_amount).toBe(5);
  });

  it("falla con cantón sin service areas", () => {
    const plan = buildRoutingPlan([], [], [item("v1")]);
    expect(plan.routable).toBe(false);
    expect(plan.reason).toBe("no_service_area_for_canton");
  });

  it("modo optimal: ítem sin stock en ninguna bodega → no_stock_for_variants", () => {
    const items = [item("v1"), item("v2")];
    const variantData = [
      variant("v1", "ii1", 1, { [QUITO]: 10 }),
      variant("v2", "ii2", 1, { [QUITO]: 0, [GUAYAQUIL]: 0 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);
    expect(plan.routable).toBe(false);
    expect(plan.reason).toContain("no_stock_for_variants:v2");
  });

  it("respeta required_quantity > 1 (pack-style)", () => {
    const items = [{ line_item_id: "li_v1", variant_id: "v1", quantity: 3 }];
    const variantData = [
      variant("v1", "ii1", 6, { [QUITO]: 5, [GUAYAQUIL]: 10 }),
    ];

    const plan = buildRoutingPlan(serviceAreas, variantData, items);
    expect(plan.routable).toBe(true);
    expect(plan.shipments[0].stock_location_id).toBe(GUAYAQUIL);
    expect(plan.shipments[0].items[0].quantity).toBe(6);
  });
});
