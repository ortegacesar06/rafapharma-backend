# Rafapharma Backend

Tienda virtual de suplementos (fitness) para Ecuador. **Backend headless** en Medusa v2 (TypeScript) + Postgres + Redis. Single-region, USD.

## Antes de hacer cualquier cambio

1. **Lee `docs/implementation_plan.md`** — es la fuente de verdad del progreso (checkboxes), las decisiones y la arquitectura objetivo.
2. **Respeta las decisiones D1–D11** (resumidas abajo). No las rediscutas a menos que el usuario lo pida explícitamente.
3. **Sigue las fases en orden** — cada fase depende de la anterior. La fase actual está marcada en la sección "Estado actual" del plan.

## Decisiones bloqueadas (D1–D13)

| # | Decisión |
|---|---|
| D1 | Stack: Medusa v2 |
| D2 | Pack = producto compuesto con BOM (no regla de carrito) |
| D3 | Ruteo bodegas: híbrido (sistema sugiere, cliente puede sobreescribir) |
| D4 | Geografía: Provincia → Cantón (Ecuador, INEC). NO postal codes |
| D5 | Split fulfillment: flag `requires_unified_shipment` por producto. Si CUALQUIER ítem lo tiene, TODA la orden sale unificada de una sola bodega |
| D6 | Flash promo: módulo custom que extiende Promotion nativo con `units_limit`, `units_sold`, `notify_on_activate` |
| D7 | Límite flash promo: GLOBAL por promoción (no por variante) |
| D8 | Chat IA: solo libre (recomienda + responde). Sin agendamiento humano. Última fase |
| D9 | Solo backend, NO monorepo |
| D10 | Email: Brevo (SDK `@getbrevo/brevo`) |
| D11 | Pagos: 3 providers (PayPhone + DeUna + transferencia manual). Solo transferencia manual activa al go-live; PayPhone y DeUna desactivados en config hasta cierre de contratos |
| D12 | Ruteo en `order.placed` (Fase 4) solo persiste decisión + ajusta reservaciones; NO crea Fulfillments automáticos. Fallback unified sin bodega completa → `requires_manual_routing`. Cantón destino en `shipping_address.metadata.canton_id` |
| D13 | Pack = Product extendido vía módulo `product-pack` (link 1:1 + tabla `PackItem`). Stock del pack se calcula on-the-fly desde componente más escaso. Pack en carrito fuerza unified shipment automáticamente; expansión a componentes ocurre en `compute-routing-plan` antes de buildRoutingPlan |
| D14 | Chat IA: **Claude Haiku 4.5** (`claude-haiku-4-5`) + **Voyage AI** `voyage-3-lite` (512 dims) para embeddings + **pgvector** (extensión Postgres, índice ivfflat cosine). Anthropic no expone endpoint de embeddings → Voyage es el recomendado por Anthropic. Rate limit por hora en endpoint: 20 IP / 60 customer. System prompt cacheable vía `cache_control: ephemeral`. Tokens consumidos se loggean y persisten en `conversation_message` |

## Convenciones de arquitectura

- **Aislamiento de módulos**: cada módulo solo conoce sus propios modelos. Para relacionar entidades de módulos distintos, usar **module links** (no FKs cruzadas).
- **Workflows para todo lo transaccional** (idempotencia, retries, compensación). Nunca lógica transaccional en endpoints.
- **Eventos > acoplamiento directo**: subscribers a `order.placed`, `cart.updated`, etc. No invocar servicios de otros módulos directamente.
- **Estructura**: `src/modules/`, `src/links/`, `src/workflows/`, `src/api/{admin,store}/`, `src/subscribers/`, `src/jobs/`, `src/scripts/`, `src/admin/`.

## Mantenimiento de este documento

- Si cambia una decisión → actualizar este archivo + `docs/implementation_plan.md` (sección Decisiones + bitácora) + `memory/project_decisions.md`.
- Si se completa una fase → agregar entrada en la bitácora del plan.
- No metas detalles efímeros aquí (estado de PRs, tareas del día). Solo lo durable.
