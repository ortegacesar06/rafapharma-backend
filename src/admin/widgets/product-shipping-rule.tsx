import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types";
import { Container, Heading, Switch, Label, Text, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";

const ProductShippingRuleWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [requiresUnified, setRequiresUnified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/admin/products/${product.id}/shipping-rule`,
          { credentials: "include" }
        );
        const json = await res.json();
        if (!cancelled) {
          setRequiresUnified(!!json?.shipping_rule?.requires_unified_shipment);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const onToggle = async (next: boolean) => {
    setSaving(true);
    const prev = requiresUnified;
    setRequiresUnified(next);
    try {
      const res = await fetch(
        `/admin/products/${product.id}/shipping-rule`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requires_unified_shipment: next }),
        }
      );
      if (!res.ok) throw new Error("Request failed");
      toast.success("Regla de envío actualizada");
    } catch (e) {
      setRequiresUnified(prev);
      toast.error("No se pudo actualizar la regla de envío");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Reglas de envío</Heading>
      </div>
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col">
          <Label htmlFor="requires_unified_shipment" weight="plus">
            Envío unificado obligatorio
          </Label>
          <Text size="small" className="text-ui-fg-subtle">
            Si está activo, una orden que contenga este producto saldrá completa
            desde una sola bodega.
          </Text>
        </div>
        <Switch
          id="requires_unified_shipment"
          checked={requiresUnified}
          onCheckedChange={onToggle}
          disabled={loading || saving}
        />
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.after",
});

export default ProductShippingRuleWidget;
