import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  PRODUCT_SHIPPING_RULES_MODULE,
} from "../../../../../modules/product-shipping-rules";
import ProductShippingRulesModuleService from "../../../../../modules/product-shipping-rules/service";

type UpsertBody = {
  requires_unified_shipment: boolean;
};

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: ProductShippingRulesModuleService = req.scope.resolve(
    PRODUCT_SHIPPING_RULES_MODULE
  );

  const [rule] = await service.listProductShippingRules({
    product_id: req.params.id,
  });

  res.json({
    shipping_rule: rule ?? {
      product_id: req.params.id,
      requires_unified_shipment: false,
    },
  });
}

export async function POST(
  req: MedusaRequest<UpsertBody>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params.id;
  const requiresUnified = !!req.body?.requires_unified_shipment;

  const service: ProductShippingRulesModuleService = req.scope.resolve(
    PRODUCT_SHIPPING_RULES_MODULE
  );
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);

  const [existing] = await service.listProductShippingRules({
    product_id: productId,
  });

  let rule;
  if (existing) {
    rule = await service.updateProductShippingRules({
      selector: { id: existing.id },
      data: { requires_unified_shipment: requiresUnified },
    });
  } else {
    [rule] = await service.createProductShippingRules([
      {
        product_id: productId,
        requires_unified_shipment: requiresUnified,
      },
    ]);

    await link.create({
      [Modules.PRODUCT]: { product_id: productId },
      [PRODUCT_SHIPPING_RULES_MODULE]: { product_shipping_rule_id: rule.id },
    });
  }

  res.json({ shipping_rule: rule });
}
