export type RoutingInputItem = {
  line_item_id?: string;
  variant_id: string;
  quantity: number;
};

export type SuggestWarehouseInput = {
  canton_id: string;
  items: RoutingInputItem[];
};

export type RoutingShipment = {
  stock_location_id: string;
  surcharge_amount: number;
  items: Array<{
    line_item_id?: string;
    variant_id: string;
    inventory_item_id: string;
    quantity: number;
  }>;
};

export type SuggestWarehouseOutput = {
  mode: "unified" | "optimal";
  routable: boolean;
  reason?: string;
  shipments: RoutingShipment[];
  total_surcharge_amount: number;
};
