import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CreditCard } from "@medusajs/icons"
import {
  Container,
  Heading,
  Table,
  Badge,
  Button,
  toast,
  Tabs,
  Text,
  Input,
  Label,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

type BankTransferOrder = {
  id: string
  display_id: number
  email: string
  total: number
  currency_code: string
  created_at: string
  metadata?: Record<string, any>
  payment_collections?: Array<{
    payments?: Array<{
      id: string
      provider_id: string
      captured_at?: string | null
      canceled_at?: string | null
      data?: Record<string, any>
    }>
  }>
}

type StatusFilter = "pending" | "captured" | "rejected"

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: currency.toUpperCase() }).format(amount)

const BankTransfersPage = () => {
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [orders, setOrders] = useState<BankTransferOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/bank-transfers?status=${status}`, { credentials: "include" })
      const json = await res.json()
      setOrders(json.orders ?? [])
    } catch {
      toast.error("No se pudieron cargar las transferencias")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [status])

  const onConfirm = async (order: BankTransferOrder) => {
    setBusyId(order.id)
    try {
      const res = await fetch(`/admin/bank-transfers/${order.id}/confirm`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error()
      toast.success(`Pago confirmado para orden #${order.display_id}`)
      await refresh()
    } catch {
      toast.error("No se pudo confirmar el pago")
    } finally {
      setBusyId(null)
    }
  }

  const onReject = async (order: BankTransferOrder) => {
    setBusyId(order.id)
    try {
      const res = await fetch(`/admin/bank-transfers/${order.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason[order.id]?.trim() || undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Pago rechazado para orden #${order.display_id}`)
      await refresh()
    } catch {
      toast.error("No se pudo rechazar el pago")
    } finally {
      setBusyId(null)
    }
  }

  const rows = useMemo(() => orders, [orders])

  return (
    <Container className="p-6">
      <Heading level="h1">Transferencias bancarias</Heading>
      <Text className="text-ui-fg-subtle mt-1">
        Verificación manual de comprobantes de pago.
      </Text>

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)} className="mt-6">
        <Tabs.List>
          <Tabs.Trigger value="pending">Pendientes</Tabs.Trigger>
          <Tabs.Trigger value="captured">Confirmados</Tabs.Trigger>
          <Tabs.Trigger value="rejected">Rechazados</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <div className="mt-4">
        {loading ? (
          <Text>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text className="text-ui-fg-subtle">Sin órdenes en este estado.</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Orden</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
                <Table.HeaderCell>Referencia</Table.HeaderCell>
                <Table.HeaderCell>Comprobante</Table.HeaderCell>
                <Table.HeaderCell>Acciones</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((order) => {
                const meta = order.metadata?.bank_transfer ?? {}
                const reference = meta.reference ?? "—"
                const proofUrl = meta.proof_file_url
                return (
                  <Table.Row key={order.id}>
                    <Table.Cell>
                      <Badge>#{order.display_id}</Badge>
                    </Table.Cell>
                    <Table.Cell>{order.email}</Table.Cell>
                    <Table.Cell>{formatMoney(order.total, order.currency_code)}</Table.Cell>
                    <Table.Cell>
                      <Text className="font-mono">{reference}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {proofUrl ? (
                        <a href={proofUrl} target="_blank" rel="noreferrer" className="text-ui-fg-interactive">
                          Ver
                        </a>
                      ) : (
                        <Text className="text-ui-fg-subtle">Sin comprobante</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {status === "pending" ? (
                        <div className="flex gap-2 items-center">
                          <Button
                            size="small"
                            variant="primary"
                            disabled={busyId === order.id || !proofUrl}
                            onClick={() => onConfirm(order)}
                          >
                            Confirmar
                          </Button>
                          <Input
                            placeholder="Motivo (opcional)"
                            value={rejectionReason[order.id] ?? ""}
                            onChange={(e) =>
                              setRejectionReason((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            className="w-40"
                          />
                          <Button
                            size="small"
                            variant="danger"
                            disabled={busyId === order.id}
                            onClick={() => onReject(order)}
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : status === "rejected" && meta.rejection_reason ? (
                        <Text className="text-ui-fg-subtle text-sm">{meta.rejection_reason}</Text>
                      ) : (
                        <Text className="text-ui-fg-subtle">—</Text>
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Transferencias",
  icon: CreditCard,
})

export default BankTransfersPage
