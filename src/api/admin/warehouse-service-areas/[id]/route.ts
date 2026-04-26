import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { WAREHOUSE_ROUTING_MODULE } from "../../../../modules/warehouse-routing";
import WarehouseRoutingModuleService from "../../../../modules/warehouse-routing/service";

type UpdateBody = {
  priority?: number;
  surcharge_amount?: number;
  stock_location_id?: string;
  canton_id?: string;
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: WarehouseRoutingModuleService = req.scope.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  const service_area = await service
    .retrieveWarehouseServiceArea(req.params.id)
    .catch(() => null);
  if (!service_area) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Service area ${req.params.id} not found`
    );
  }

  res.json({ service_area });
}

export async function POST(
  req: MedusaRequest<UpdateBody>,
  res: MedusaResponse
): Promise<void> {
  const service: WarehouseRoutingModuleService = req.scope.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  const service_area = await service.updateWarehouseServiceAreas({
    selector: { id: req.params.id },
    data: req.body ?? {},
  });

  res.json({ service_area });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: WarehouseRoutingModuleService = req.scope.resolve(
    WAREHOUSE_ROUTING_MODULE
  );

  await service.deleteWarehouseServiceAreas(req.params.id);

  res.json({ id: req.params.id, object: "warehouse_service_area", deleted: true });
}
