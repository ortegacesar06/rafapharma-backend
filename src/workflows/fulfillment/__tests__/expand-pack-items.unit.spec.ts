import {
  expandPackItems,
  type PackComponent,
} from "../expand-pack-items";
import type { RoutingInputItem } from "../types";

describe("expandPackItems", () => {
  const buildMap = (
    entries: Array<[string, PackComponent[]]>
  ): Map<string, PackComponent[]> => new Map(entries);

  it("deja los items intactos cuando ninguna variante es pack", () => {
    const items: RoutingInputItem[] = [
      { line_item_id: "li_1", variant_id: "var_a", quantity: 2 },
    ];

    const out = expandPackItems({
      items,
      packComponentsByVariantId: new Map(),
    });

    expect(out.hasPacks).toBe(false);
    expect(out.fromPackVariantIds.size).toBe(0);
    expect(out.expandedItems).toEqual(items);
  });

  it("expande un pack en sus componentes multiplicando la cantidad", () => {
    const items: RoutingInputItem[] = [
      { line_item_id: "li_pack", variant_id: "var_pack", quantity: 3 },
    ];
    const map = buildMap([
      [
        "var_pack",
        [
          { variant_id: "var_c1", quantity: 2 },
          { variant_id: "var_c2", quantity: 1 },
        ],
      ],
    ]);

    const out = expandPackItems({ items, packComponentsByVariantId: map });

    expect(out.hasPacks).toBe(true);
    expect(out.fromPackVariantIds).toEqual(new Set(["var_c1", "var_c2"]));
    expect(out.expandedItems).toEqual([
      { line_item_id: "li_pack", variant_id: "var_c1", quantity: 6 },
      { line_item_id: "li_pack", variant_id: "var_c2", quantity: 3 },
    ]);
  });

  it("mezcla items normales y packs en el mismo carrito", () => {
    const items: RoutingInputItem[] = [
      { line_item_id: "li_normal", variant_id: "var_normal", quantity: 4 },
      { line_item_id: "li_pack", variant_id: "var_pack", quantity: 1 },
    ];
    const map = buildMap([
      ["var_pack", [{ variant_id: "var_c1", quantity: 5 }]],
    ]);

    const out = expandPackItems({ items, packComponentsByVariantId: map });

    expect(out.hasPacks).toBe(true);
    expect(out.expandedItems).toEqual([
      { line_item_id: "li_normal", variant_id: "var_normal", quantity: 4 },
      { line_item_id: "li_pack", variant_id: "var_c1", quantity: 5 },
    ]);
    expect(out.fromPackVariantIds).toEqual(new Set(["var_c1"]));
  });

  it("trata un pack con items vacíos como variante normal", () => {
    const items: RoutingInputItem[] = [
      { line_item_id: "li_x", variant_id: "var_x", quantity: 1 },
    ];
    const map = buildMap([["var_x", []]]);

    const out = expandPackItems({ items, packComponentsByVariantId: map });

    expect(out.hasPacks).toBe(false);
    expect(out.expandedItems).toEqual(items);
  });
});
