import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { suggestWarehouseWorkflow } from "../../../../workflows/fulfillment";

type Body = {
  cart_id?: string;
  canton_id?: string;
  items?: Array<{ variant_id: string; quantity: number }>;
};

export async function POST(
  req: MedusaRequest<Body>,
  res: MedusaResponse
): Promise<void> {
  const body = req.body ?? {};
  let cantonId = body.canton_id;
  let items = body.items;

  if (body.cart_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "cart",
      filters: { id: body.cart_id },
      fields: [
        "id",
        "shipping_address.metadata",
        "items.variant_id",
        "items.quantity",
      ],
    });
    const cart = data?.[0];
    if (!cart) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Cart ${body.cart_id} not found`
      );
    }
    cantonId =
      cantonId ?? ((cart.shipping_address?.metadata as any)?.canton_id);
    items =
      items ??
      (cart.items ?? [])
        .filter((i: any) => i.variant_id)
        .map((i: any) => ({
          variant_id: i.variant_id,
          quantity: Number(i.quantity),
        }));
  }

  if (!cantonId || !items?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "canton_id and items (or a cart_id with shipping address + items) are required"
    );
  }

  const { result } = await suggestWarehouseWorkflow(req.scope).run({
    input: { canton_id: cantonId, items },
  });

  res.json({ preview: result });
}
