import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { PRODUCT_PACK_MODULE } from "../../../../../modules/product-pack";
import ProductPackModuleService from "../../../../../modules/product-pack/service";

type UpsertBody = {
  items: Array<{ variant_id: string; quantity: number }>;
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ProductPackModuleService = req.scope.resolve(
    PRODUCT_PACK_MODULE
  );

  const [pack] = await service.listProductPacks(
    { product_id: req.params.id },
    { relations: ["items"] }
  );

  res.json({ pack: pack ?? null });
}

export async function POST(
  req: MedusaRequest<UpsertBody>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params.id;
  const body = req.body ?? ({} as UpsertBody);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "items must be a non-empty array"
    );
  }

  for (const it of body.items) {
    if (!it.variant_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "every pack item requires variant_id"
      );
    }
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `pack item ${it.variant_id} requires quantity >= 1`
      );
    }
  }

  const service: ProductPackModuleService = req.scope.resolve(
    PRODUCT_PACK_MODULE
  );
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);

  let [pack] = await service.listProductPacks(
    { product_id: productId },
    { relations: ["items"] }
  );

  if (!pack) {
    [pack] = await service.createProductPacks([{ product_id: productId }]);
    await link.create({
      [Modules.PRODUCT]: { product_id: productId },
      [PRODUCT_PACK_MODULE]: { product_pack_id: pack.id },
    });
  }

  const existingItems = await service.listPackItems({ pack_id: pack.id });
  if (existingItems.length > 0) {
    await service.deletePackItems(existingItems.map((i) => i.id));
  }

  await service.createPackItems(
    body.items.map((it) => ({
      pack_id: pack.id,
      variant_id: it.variant_id,
      quantity: it.quantity,
    }))
  );

  const [refreshed] = await service.listProductPacks(
    { id: pack.id },
    { relations: ["items"] }
  );

  res.json({ pack: refreshed });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params.id;

  const service: ProductPackModuleService = req.scope.resolve(
    PRODUCT_PACK_MODULE
  );
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);

  const [pack] = await service.listProductPacks({ product_id: productId });
  if (!pack) {
    res.status(204).send();
    return;
  }

  await link.dismiss({
    [Modules.PRODUCT]: { product_id: productId },
    [PRODUCT_PACK_MODULE]: { product_pack_id: pack.id },
  });
  await service.deleteProductPacks([pack.id]);

  res.status(204).send();
}
