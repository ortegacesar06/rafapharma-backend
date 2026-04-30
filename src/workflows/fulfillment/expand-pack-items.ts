import type { RoutingInputItem } from "./types";

export type PackComponent = {
  variant_id: string;
  quantity: number;
};

export type ExpandPackItemsInput = {
  items: RoutingInputItem[];
  /** variant_id → componentes del pack (si la variante pertenece a un Product que es pack) */
  packComponentsByVariantId: Map<string, PackComponent[]>;
};

export type ExpandPackItemsOutput = {
  expandedItems: RoutingInputItem[];
  /** variant_ids resultantes que provienen de la expansión de un pack */
  fromPackVariantIds: Set<string>;
  hasPacks: boolean;
};

/**
 * Expande items que correspondan a packs (productos compuestos) a sus variantes
 * componente. Cada componente queda con `quantity = component.qty * item.qty`
 * y conserva el `line_item_id` original del pack.
 */
export function expandPackItems({
  items,
  packComponentsByVariantId,
}: ExpandPackItemsInput): ExpandPackItemsOutput {
  const expandedItems: RoutingInputItem[] = [];
  const fromPackVariantIds = new Set<string>();
  let hasPacks = false;

  for (const item of items) {
    const components = packComponentsByVariantId.get(item.variant_id);

    if (!components || components.length === 0) {
      expandedItems.push(item);
      continue;
    }

    hasPacks = true;
    for (const comp of components) {
      expandedItems.push({
        line_item_id: item.line_item_id,
        variant_id: comp.variant_id,
        quantity: comp.quantity * item.quantity,
      });
      fromPackVariantIds.add(comp.variant_id);
    }
  }

  return { expandedItems, fromPackVariantIds, hasPacks };
}
