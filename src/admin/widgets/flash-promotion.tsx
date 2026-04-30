import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps } from "@medusajs/framework/types"
import {
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Button,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type FlashPromotionDTO = {
  id: string
  promotion_id: string
  units_limit: number | null
  units_sold: number
  notify_on_activate: boolean
  notification_segment: string | null
  notified_at: string | null
}

const FlashPromotionWidget = ({
  data: promotion,
}: DetailWidgetProps<{ id: string }>) => {
  const [flash, setFlash] = useState<FlashPromotionDTO | null>(null)
  const [unitsLimit, setUnitsLimit] = useState<string>("")
  const [notifyOnActivate, setNotifyOnActivate] = useState(false)
  const [segment, setSegment] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/admin/promotions/${promotion.id}/flash`, {
          credentials: "include",
        })
        const json = await res.json()
        if (!cancelled) {
          const f: FlashPromotionDTO | null = json?.flash ?? null
          setFlash(f)
          setUnitsLimit(f?.units_limit?.toString() ?? "")
          setNotifyOnActivate(!!f?.notify_on_activate)
          setSegment(f?.notification_segment ?? "")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [promotion.id])

  const onSave = async () => {
    setSaving(true)
    try {
      const limitNum =
        unitsLimit.trim() === "" ? null : Number(unitsLimit.trim())
      if (limitNum !== null && (!Number.isInteger(limitNum) || limitNum < 1)) {
        toast.error("Límite de unidades debe ser entero positivo o vacío")
        return
      }
      const res = await fetch(`/admin/promotions/${promotion.id}/flash`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units_limit: limitNum,
          notify_on_activate: notifyOnActivate,
          notification_segment: segment.trim() === "" ? null : segment.trim(),
        }),
      })
      if (!res.ok) throw new Error("Request failed")
      const json = await res.json()
      setFlash(json.flash)
      toast.success("Configuración flash guardada")
    } catch (e) {
      toast.error("No se pudo guardar la configuración flash")
    } finally {
      setSaving(false)
    }
  }

  const onRemove = async () => {
    if (!flash) return
    setSaving(true)
    try {
      const res = await fetch(`/admin/promotions/${promotion.id}/flash`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok && res.status !== 204) throw new Error("Request failed")
      setFlash(null)
      setUnitsLimit("")
      setNotifyOnActivate(false)
      setSegment("")
      toast.success("Configuración flash eliminada")
    } catch (e) {
      toast.error("No se pudo eliminar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Flash promotion</Heading>
        {flash && (
          <Text size="small" className="text-ui-fg-subtle">
            Vendidas: {flash.units_sold}
            {flash.units_limit !== null ? ` / ${flash.units_limit}` : ""}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-y-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="units_limit" weight="plus">
            Límite global de unidades
          </Label>
          <Text size="small" className="text-ui-fg-subtle">
            Vacío = sin límite. Cuenta atómica al confirmar la orden.
          </Text>
          <Input
            id="units_limit"
            type="number"
            min={1}
            value={unitsLimit}
            onChange={(e) => setUnitsLimit(e.target.value)}
            disabled={loading || saving}
          />
        </div>

        <div className="flex items-start justify-between gap-x-4">
          <div className="flex flex-col">
            <Label htmlFor="notify_on_activate" weight="plus">
              Notificar al activar
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              Al iniciar la campaña se envía email al segmento configurado.
            </Text>
          </div>
          <Switch
            id="notify_on_activate"
            checked={notifyOnActivate}
            onCheckedChange={setNotifyOnActivate}
            disabled={loading || saving}
          />
        </div>

        <div className="flex flex-col gap-y-1">
          <Label htmlFor="notification_segment" weight="plus">
            Segmento de notificación
          </Label>
          <Text size="small" className="text-ui-fg-subtle">
            Identificador del segmento en Brevo (ej: newsletter_subscribers).
          </Text>
          <Input
            id="notification_segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            disabled={loading || saving || !notifyOnActivate}
          />
        </div>

        <div className="flex justify-end gap-x-2">
          {flash && (
            <Button
              variant="secondary"
              onClick={onRemove}
              disabled={loading || saving}
            >
              Quitar configuración
            </Button>
          )}
          <Button onClick={onSave} disabled={loading || saving} isLoading={saving}>
            Guardar
          </Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "promotion.details.after",
})

export default FlashPromotionWidget
