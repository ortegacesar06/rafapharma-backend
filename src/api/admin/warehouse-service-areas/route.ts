import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { WAREHOUSE_ROUTING_MODULE } from "../../../modules/warehouse-routing";
import WarehouseRoutingModuleService from "../../../modules/warehouse-routing/service";

type CreateBody = {
  stock_location_id: string;
  canton_id: string;
  priority?: number;
  surcharge_amount?: number;
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: WarehouseRoutingModuleService = req.scope.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  const { stock_location_id, canton_id } = req.query as Record<string, string>;
  const filters: Record<string, string> = {};
  if (stock_location_id) filters.stock_location_id = stock_location_id;
  if (canton_id) filters.canton_id = canton_id;

  const service_areas = await service.listWarehouseServiceAreas(
    filters,
    { order: { priority: "ASC" } }
  );

  res.json({ service_areas });
}

export async function POST(
  req: MedusaRequest<CreateBody>,
  res: MedusaResponse
): Promise<void> {
  const service: WarehouseRoutingModuleService = req.scope.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  const body = req.body;
  if (!body?.stock_location_id || !body?.canton_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "stock_location_id and canton_id are required"
    );
  }

  const [service_area] = await service.createWarehouseServiceAreas([
    {
      stock_location_id: body.stock_location_id,
      canton_id: body.canton_id,
      priority: body.priority ?? 100,
      surcharge_amount: body.surcharge_amount ?? 0,
    },
  ]);

  res.status(201).json({ service_area });
}
