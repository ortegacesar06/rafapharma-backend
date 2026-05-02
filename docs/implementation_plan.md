# Plan de implementación — Rafapharma Backend

> Documento de progreso. Sobrevive entre sesiones. Marcar checkboxes al completar cada paso.
> **Última actualización**: 2026-05-01 (Fase 9.A completa)

---

## Cómo usar este documento

- Cada **fase** agrupa un entregable funcional. Las fases se hacen en orden (cada una depende de la anterior).
- Cada **paso** dentro de una fase tiene: objetivo, archivos, criterio de hecho.
- Al retomar el trabajo: leer la sección [Estado actual](#estado-actual) y seguir desde el primer paso sin marcar.
- Si una decisión cambia, actualizar la sección [Decisiones](#decisiones-aterrizadas) Y este encabezado.

---

## Contexto del proyecto

**Producto**: Tienda virtual de suplementos (fitness) para Rafapharma.
**Mercado**: Ecuador, moneda USD, single-region.
**Stack**: Medusa v2 (Node.js / TypeScript), Postgres, Redis.
**Repo**: vacío al inicio. Bootstrap desde `create-medusa-app`.

### Requisitos funcionales (resumen)

1. Tienda estándar (productos, variantes/tamaños, precios, descuentos, carrito, checkout, órdenes) → **nativo de Medusa**.
2. Multi-bodega con ruteo geográfico por provincia/cantón → **custom**.
3. Promociones flash (24h configurable) con countdown, límite global de unidades opcional, notificación email opcional → **custom**.
4. Packs (productos compuestos con BOM, stock controlado por componente) → **custom**.
5. Chat IA libre (recomienda productos + responde dudas) → **custom, fase final**.

---

## Decisiones aterrizadas

| # | Decisión | Razón |
|---|---|---|
| D1 | Medusa v2 sobre Saleor / custom | Modular, TypeScript, cubre 70% nativo, extensible vía módulos |
| D2 | Pack = producto compuesto con BOM (no regla de carrito) | Requisito explícito: stock por componente, pack visible en catálogo |
| D3 | Ruteo bodega = híbrido (sistema sugiere, cliente puede sobreescribir) | Mejor UX, control para casos atípicos |
| D4 | Granularidad geográfica: Provincia → Cantón (Ecuador, fuente INEC) | Postal codes en Ecuador no son confiables |
| D5 | Split fulfillment = flag por producto, **interpretación 1**: si CUALQUIER ítem en el carrito tiene `requires_unified_shipment=true`, toda la orden sale de una sola bodega | "Productos críticos" (packs, tratamientos) deben llegar completos |
| D6 | Flash promo = módulo custom que extiende Promotion nativo con: `units_limit` (global), `units_sold` (contador atómico), `notify_on_activate` | Ventana temporal ya está en Promotion+Campaign; lo extra es nuestro |
| D7 | Límite de unidades flash promo = **global** (un contador por promoción, no por variante) | Suficiente para flash sales típicos, UI más simple |
| D8 | Chat IA = solo libre (recomendar + responder). Sin agendamiento humano | Scope reducido para fase final |
| D9 | Estructura = solo backend (sin monorepo) | Storefront se construirá aparte cuando se decida; este repo es backend headless |
| D10 | Email provider = Brevo (transaccional + listas) | Free tier suficiente para arranque, SDK oficial, soporta listas para flash promo emails |
| D12 | Fase 4: ruteo en `order.placed` solo **persiste decisión + ajusta reservaciones**, **NO crea Fulfillments** automáticos (Opción A). Si modo `unified` no encuentra bodega completa, orden queda `requires_manual_routing` (no split, no cancelar). El cantón destino se lee de `shipping_address.metadata.canton_id`. | Mantiene control humano sobre el despacho físico. Marcar para revisión manual es lo más conservador frente a contradecir el flag o cancelar la orden. |
| D13 | Pack = Product extendido vía módulo `product-pack` separado (link 1:1 Product↔ProductPack + tabla `PackItem` con (pack_id, variant_id, quantity)). Stock del pack se calcula on-the-fly desde el componente más escaso (NO se mantiene inventario propio del pack). Cualquier pack en el carrito **fuerza unified shipment** automáticamente; expansión de packs ocurre en `compute-routing-plan` antes de buildRoutingPlan, así reservaciones aterrizan en componentes vía el flujo existente. | Reutiliza pricing/imágenes/SEO/búsqueda nativos de Medusa. Calcular stock vía componentes elimina contadores en sync. Forzar unified evita que un pack llegue partido en envíos distintos. Sin workflow nuevo: el `replace-order-reservations` existente cubre el caso. |
| D11 | Pagos = **3 providers independientes**: (a) PayPhone (tarjeta + QR), (b) DeUna API directa, (c) transferencia manual. **Rollout en fases**: solo (c) activa al inicio; (a) y (b) se prenden cuando se cierren los contratos con cada proveedor. Cada provider es un módulo Medusa que se activa/desactiva en `medusa-config.ts` (región Ecuador → `payment_providers`). | Permite lanzar la tienda con el método más simple (sin dependencia de contratos); luego prender PayPhone y DeUna sin reescribir código. |

---

## Arquitectura — convenciones

- **Aislamiento de módulos**: cada módulo solo conoce sus propios modelos. Para relacionar entidades de distintos módulos, usar **module links** (no FKs cruzadas).
- **Workflows para todo lo transaccional**: idempotencia + retries + compensación. Nunca lógica transaccional en endpoints.
- **Eventos > acoplamiento**: subscribers a `order.placed`, `cart.updated`, etc. No invocar servicios de otros módulos directamente.
- **Admin extensions** en `src/admin/` (widgets, routes) para lo que necesite UI.

### Estructura de carpetas objetivo

```
src/
├── modules/
│   ├── geography/          # Province, Canton (Ecuador)
│   ├── warehouse-routing/  # WarehouseServiceArea (link bodega ↔ cantón)
│   ├── product-pack/       # Pack, PackItem (BOM)
│   ├── flash-promotion/    # extiende Promotion
│   └── ai-assistant/       # Conversation, Message, RAG
├── links/                  # Pack↔Variant, Customer↔Conversation, etc.
├── workflows/
│   ├── pack/
│   ├── fulfillment/
│   └── flash-promotion/
├── api/
│   ├── admin/
│   └── store/
├── subscribers/
├── jobs/                   # cron
├── scripts/                # seeds, one-off
└── admin/                  # extensiones de Admin UI
```

---

## Estado actual

**Fase activa**: Fase 9.A completa (transferencia manual lista para go-live).
**Próximo paso**: Fase 9.B (PayPhone, espera contrato) o Fase 9.D (selección de método en checkout).

---

## Fase 0 — Bootstrap del proyecto

**Objetivo**: Tener Medusa v2 corriendo en local con Postgres, Redis y configuración para Ecuador/USD.

- [x] **0.1** Bootstrap con `create-medusa-app@latest` (template viene como monorepo con `apps/backend`; aplanado a la raíz por D9). Postgres+Redis vía `docker-compose.yml`. `npm run dev` levanta servidor en `:9000`.
- [x] **0.2** `.env` y `.env.template` con `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`.
- [x] **0.3** Región Ecuador / USD vía `src/scripts/seed.ts` (sales channel, publishable API key, store, region EC, tax region). Redis cache/event-bus/locking/workflow-engine wired en `medusa-config.ts`.
- [x] **0.4** Usuario admin creado (`admin@rafapharma.ec`).
- [x] **0.5** Admin UI accesible en `http://localhost:9000/app` (HTTP 200).
- [x] **0.6** Jest configurado (`test:unit` / `test:integration:*`) + smoke test en `src/__tests__/smoke.unit.spec.ts`.
- [ ] **0.7** Commit inicial con mensaje `chore: bootstrap medusa v2 project`.

**Criterio de hecho**: backend corre, admin UI accesible, región Ecuador/USD configurada.

---

## Fase 1 — Geografía (Ecuador)

**Objetivo**: Modelo de provincias y cantones disponibles para uso por warehouse-routing y direcciones de cliente.

- [x] **1.1** Módulo `src/modules/geography/` con modelos `Province` y `Canton` (relación `hasMany`/`belongsTo`). Migración `Migration20260426174208.ts`.
- [x] **1.2** Seed `src/scripts/seed-geography.ts` con 24 provincias y 221 cantones (dataset hardcodeado en `seed-geography-data.ts`, basado en INEC DPA post-2013). Idempotente: salta los que ya existen.
- [x] **1.3** Endpoints `GET /store/provinces` y `GET /store/provinces/:id/cantons`.
- [x] **1.4** Tests unitarios sobre el dataset (24 provincias, 221 cantones, códigos únicos, formato `<province_code><nn>`); endpoints validados manualmente vía curl.

**Criterio de hecho**: storefront puede armar dropdowns provincia → cantón.

---

## Fase 2 — Warehouses + Service Areas

**Objetivo**: Cada bodega declara qué cantones cubre, con prioridad. Base para el ruteo.

- [x] **2.1** Módulo `src/modules/warehouse-routing/` con modelo `WarehouseServiceArea` (stock_location_id, canton_id, priority, surcharge_amount). Migración `Migration20260426215858.ts`. Índice único `(stock_location_id, canton_id)`.
- [x] **2.2** Module links en `src/links/`: `stock-location-service-area.ts` y `canton-service-area.ts` (ambos `isList: true`).
- [x] **2.3** Admin CRUD: `GET/POST /admin/warehouse-service-areas` y `GET/POST/DELETE /admin/warehouse-service-areas/[id]`.
- [x] **2.4** Seed `src/scripts/seed-warehouses.ts`: crea Bodega Quito (Pichincha) y Bodega Guayaquil (Guayas), idempotente; service area por cada cantón con priority 0/recargo 0 si es local a la provincia, priority 100/recargo $5 fuera.
- [x] **2.5** Test integration:modules en `src/modules/warehouse-routing/__tests__/warehouse-routing.spec.ts` (orden por prioridad, unique constraint, filtro por bodega). Requirió `.env.test` con `DB_HOST`/`DB_USERNAME`/`DB_PASSWORD`/`DB_TEMP_NAME`.

**Criterio de hecho**: dado cualquier cantón ecuatoriano, el sistema sabe qué bodegas pueden despacharlo y con qué recargo.

---

## Fase 3 — Flag de envío unificado en producto

**Objetivo**: Permitir marcar productos como "no separable del resto del envío".

- [x] **3.1** Módulo `src/modules/product-shipping-rules/` con modelo `ProductShippingRule` (`product_id` único, `requires_unified_shipment` boolean default false). Module link Product ↔ ProductShippingRule en `src/links/product-shipping-rule.ts` (1:1, no `isList`).
- [x] **3.2** Migración `Migration20260426221243.ts` (vía `medusa db:generate product_shipping_rules`) + `medusa db:sync-links`.
- [x] **3.3** Admin: endpoint `GET/POST /admin/products/:id/shipping-rule` (upsert por product_id, crea link en el primer POST). Widget Admin UI en `src/admin/widgets/product-shipping-rule.tsx` (zona `product.details.after`) con Switch.
- [x] **3.4** Test integration:modules en `src/modules/product-shipping-rules/__tests__/product-shipping-rules.spec.ts` (default false, persistencia, unique por product_id, toggle vía update).

**Criterio de hecho**: admin puede marcar productos como "envío unificado obligatorio".

---

## Fase 4 — Workflow de ruteo

**Objetivo**: Decidir desde qué bodega(s) sale cada orden.

- [x] **4.1** Workflow `suggest-warehouse` (read-only) en `src/workflows/fulfillment/`. Algoritmo extraído como función pura `buildRoutingPlan()` (`build-routing-plan.ts`); el step `compute-routing-plan` resuelve service areas (vía módulo `warehouse-routing`) + variantes/inventario/`product.shipping_rule` (vía `query.graph`) y delega.
- [x] **4.2** Workflow `route-fulfillment` (`route-fulfillment.ts`) compuesto por: `load-order-routing-input` (lee canton de `order.shipping_address.metadata.canton_id`) → `compute-routing-plan` → `persist-order-routing` (módulo nuevo `order-routing` + module link Order↔OrderRouting) → `replace-order-reservations` (vía `when(plan.routable)`). Compensación: el step de persistencia borra el routing creado; el de reservas restaura las anteriores.
- [x] **4.3** Subscriber `src/subscribers/route-order-fulfillment.ts` al evento `order.placed`.
- [x] **4.4** Tests:
  - Unit: `build-routing-plan.unit.spec.ts` cubre los 4 escenarios (T1–T4) + edge cases (sin service areas, sin stock global, prioridad, `required_quantity > 1`).
  - Integration:modules: `order-routing.spec.ts` valida CRUD del módulo (creación con shipments, unique por order_id, status `requires_manual_routing`).
  - Decisión sobre el fallback (T4): orden marcada `status=requires_manual_routing` (D adicional, ver decisión D12 abajo); no se hace split forzado ni se cancela.
- [x] **4.5** Endpoint store `POST /store/cart/shipping-preview` (`src/api/store/cart/shipping-preview/route.ts`). Acepta `cart_id` (auto-resuelve canton+items) o `canton_id`+`items` explícitos.

**Criterio de hecho**: una orden colocada se rutea automáticamente; storefront ve preview de costos antes de pagar.

---

## Fase 5 — Product Packs

**Objetivo**: Crear packs como productos compuestos con BOM, stock controlado por componente.

- [x] **5.1** Módulo `src/modules/product-pack/` con modelos `ProductPack` (`product_id` único) y `PackItem` (`pack_id`, `variant_id`, `quantity`, índice único `(pack_id, variant_id)`). Migración `Migration20260430024414.ts`. Cf. D13.
- [x] **5.2** Module link Product↔ProductPack en `src/links/product-pack.ts` (1:1). El link Pack↔Variant se materializa por columna `variant_id` en `PackItem` (sin defineLink adicional: PackItem ES la tabla pivote).
- [x] **5.3** Admin endpoint `GET/POST/DELETE /admin/products/:id/pack` (`src/api/admin/products/[id]/pack/route.ts`): GET retorna pack+items, POST hace upsert (crea ProductPack + link en el primer POST, reemplaza items completos), DELETE quita el pack.
- [x] **5.4** Integración con fulfillment Fase 4: función pura `expandPackItems` (`src/workflows/fulfillment/expand-pack-items.ts`) y nueva fase en `compute-routing-plan` que primero resuelve `product.product_pack.items` para los variant_ids del input, expande items pack→componentes (qty×qty, conserva line_item_id) y marca `requires_unified_shipment=true` para forzar unified. **No se creó un workflow `reserve-pack-inventory` separado**: el `replace-order-reservations` existente reserva ya contra los inventory items de los componentes porque la expansión ocurre upstream en el plan.
- [x] **5.5** Cubierto por 5.4 — el subscriber existente `route-order-fulfillment` ejecuta la cadena `route-fulfillment` que ya incluye expansión + reservaciones. No se agrega subscriber nuevo.
- [x] **5.6** Sin trabajo extra: `ProductPack` linkea con `Product`, así que el pack ya aparece en `/store/products` como cualquier otro producto.
- [x] **5.7** Tests:
  - Unit: `expand-pack-items.unit.spec.ts` (4 escenarios: sin packs, pack puro, pack+items normales mezclados, pack con items vacíos).
  - Integration:modules: `product-pack.spec.ts` (creación con items, unique por product_id, unique (pack_id, variant_id), reemplazo de items).

**Criterio de hecho**: admin crea un pack, cliente lo compra, stock de componentes baja correctamente, envío sale unificado.

---

## Fase 6 — Flash Promotions

**Objetivo**: Promociones por tiempo limitado con countdown, límite global de unidades opcional, email opcional.

- [x] **6.1** Módulo `src/modules/flash-promotion/` con `FlashPromotion` (`promotion_id` único, `units_limit` nullable, `units_sold` default 0, `notify_on_activate` bool, `notification_segment` nullable, `notified_at` nullable). Migración `Migration20260430163518.ts`.
- [x] **6.2** Module link `Promotion ↔ FlashPromotion` (1:1) en `src/links/flash-promotion.ts`.
- [x] **6.3** Admin endpoints `GET/POST/DELETE /admin/promotions/:id/flash` (upsert, crea link en el primer POST). Widget `src/admin/widgets/flash-promotion.tsx` (zone `promotion.details.after`) con inputs para los 3 campos + contador de vendidas vs límite.
- [x] **6.4** Workflow `decrement-flash-units` con step atómico: `UPDATE flash_promotion SET units_sold = units_sold + ? WHERE promotion_id = ? AND (units_limit IS NULL OR units_sold + ? <= units_limit) RETURNING ...`. Si la fila resultante alcanza el límite, el step llama `Modules.PROMOTION.updatePromotions({ status: PromotionStatus.INACTIVE })` para desactivar la promo nativa. Compensación: decrementa lo que se aplicó. Cf. test "is atomic under concurrent increments" (20 increments paralelos en límite 10 → 10 aceptados / 10 rechazados, units_sold final = 10).
- [x] **6.5** Subscriber `src/subscribers/decrement-flash-units.ts` lee `items[].adjustments[].promotion_id` vía `query.graph`, agrega cantidad por promotion (función pura `buildFlashRequests`) y dispara el workflow. Decisión confirmada: se ejecuta en `order.placed` (no al agregar al carrito).
- [x] **6.6** Workflow `activate-flash-promotion` con step `notify-flash-activation`: resuelve `Modules.NOTIFICATION` (skip silencioso si Brevo no está cargado), envía template `flash-promotion-activated` a los recipients del segmento, marca `notified_at`. Resolución de segmento es placeholder hasta Fase 8.5 (sync con listas Brevo).
- [x] **6.7** Cron `src/jobs/expire-flash-promotions.ts` (`* * * * *`): para cada flash promo (a) si `starts_at <= now` y `notified_at` vacío y `notify_on_activate=true` → dispara `activate-flash-promotion`; (b) si `ends_at <= now` y status no es inactive → desactiva la promo nativa. Idempotente.
- [x] **6.8** Endpoint `GET /store/flash-promotions/active` retorna sólo promos activas, dentro de ventana, no agotadas. Cada item incluye `time_remaining_seconds`, `units_remaining` (cuando hay límite), `code`, `campaign_name`, `starts_at`, `ends_at`.
- [x] **6.9** Tests:
  - Unit: `build-flash-requests.unit.spec.ts` (5 escenarios: vacío, sin promos, agregación cross-item, dedup multi-adjustment del mismo promo, qty<=0).
  - Integration:modules: `flash-promotion.spec.ts` (9 tests, incluye atomicidad con 20 promesas paralelas y `markNotified` idempotente).

**Criterio de hecho**: admin crea flash promo de 24h con límite de 50 unidades; storefront muestra countdown y límite; al venderse 50, deja de aplicar.

---

## Fase 7 — AI Assistant (chat libre)

**Objetivo**: Chat IA que recomienda productos y responde dudas, con RAG sobre el catálogo.

- [x] **7.1** Módulo `src/modules/ai-assistant/` con `Conversation` (`customer_id` nullable, `started_at`), `Message` (`conversation_id`, `role` enum user/assistant/system, `content`, `input_tokens`/`output_tokens` nullable) y `ProductEmbedding` (`product_id` único, `embedding_model`, `source_text`; columna `embedding vector(512)` agregada vía SQL raw en la migración). Migración `Migration20260501000000.ts` que también crea la extensión `vector` y un índice ivfflat para cosine similarity.
- [x] **7.2** Module link `Customer ↔ Conversation` (1:N) en `src/links/customer-conversation.ts`.
- [x] **7.3** Decisión confirmada: **Claude Haiku 4.5** (`claude-haiku-4-5`) vía `@anthropic-ai/sdk` con prompt caching del system prompt fijo. Embeddings con **Voyage AI** `voyage-3-lite` (512 dims) vía HTTP directo (sin SDK extra) — Anthropic no expone endpoint de embeddings.
- [x] **7.4** Pgvector + Voyage. Servicio expone `upsertProductEmbedding`, `deleteProductEmbedding`, `findSimilarProducts` (raw SQL con `<=>`). Workflow `embed-product` (`src/workflows/ai-assistant/embed-product.ts`) lee producto vía `query.graph`, arma `source_text` (función pura `buildProductSourceText`: título + subtítulo + tipo + categorías + tags + descripción) y embebe con Voyage. Skip silencioso si `VOYAGE_API_KEY` falta.
- [x] **7.5** Workflow `chat-respond` (`src/workflows/ai-assistant/chat-respond.ts`) compuesto por 5 steps con compensación: persiste user message → carga historial (últimos 12, orden ASC) → embebe query y recupera top-5 productos similares → llama Claude (system con `cache_control` ephemeral en prompt fijo + bloque RAG sin cache) → persiste respuesta con `input_tokens`/`output_tokens`. Funciones puras `buildContextBlock` y `buildAnthropicMessages` (filtra system, mergea consecutivos, garantiza primer turno user) extraídas para test sin SDK.
- [x] **7.6** Endpoint `POST /store/chat/messages` (`src/api/store/chat/messages/route.ts`). Crea conversation si no existe; si hay customer logueado dispara `link.create` Customer↔Conversation. Body: `{ conversation_id?, message }`. Respuesta incluye `conversation_id`, `message`, `usage.{input,output}_tokens`.
- [x] **7.7** Subscribers `embed-product` (en `product.created`/`product.updated`) y `delete-product-embedding` (en `product.deleted`). El primer skip silencioso si `VOYAGE_API_KEY` falta.
- [x] **7.8** Tests unitarios:
  - `voyage.unit.spec.ts` (4 escenarios para `buildProductSourceText`).
  - `chat-respond.unit.spec.ts` (7 escenarios para `buildContextBlock` y `buildAnthropicMessages`).
  - `ai-assistant.spec.ts` (integration:modules, 4 escenarios CRUD; requiere `.env.test` con DB y extensión vector — no corrido en esta sesión).
- [x] **7.9** Rate limiting via módulo `cache` (Redis ya wired) — buckets por hora: `chat:rl:cust:<id>:<bucket>` (60/h por defecto) y `chat:rl:ip:<ip>:<bucket>` (20/h por defecto). Configurable vía `CHAT_RATE_LIMIT_PER_HOUR_*`. Logging de `input_tokens`/`output_tokens` en cada response del endpoint y persistido en `conversation_message`.

**Criterio de hecho**: cliente chatea, el bot responde con recomendaciones del catálogo real.

---

## Fase 8 — Notificaciones (Brevo)

**Objetivo**: Provider de email transaccional vía Brevo, integrado con eventos de Medusa.

> Nota: aunque está numerada 8, partes de esta fase se necesitan antes (Fase 6 envía emails de flash promo activada). **Hacer 8.1–8.4 después de Fase 0** y dejar 8.5+ para después.

- [x] **8.1** Módulo `src/modules/notification-brevo/` con `BrevoNotificationProviderService` (extiende `AbstractNotificationProviderService`, identifier `brevo`) + `index.ts` con `ModuleProvider(Modules.NOTIFICATION, ...)`. Usa SDK `@getbrevo/brevo` v5 (`BrevoClient.transactionalEmails.sendTransacEmail`). Registrado bajo `@medusajs/medusa/notification` en `medusa-config.ts` con guard `process.env.BREVO_API_KEY` (si no está seteado, el módulo no se carga — útil para dev/test sin credenciales).
- [x] **8.2** `.env.template` con `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `BREVO_REPLY_TO_EMAIL`, `BREVO_REPLY_TO_NAME` y `BREVO_TEMPLATE_*` para los 4 templates iniciales.
- [x] **8.3** Mapping de templates simbólicos (`order-placed`, `order-shipped`, `order-delivered`, `password-reset`) → IDs numéricos de Brevo vía `options.templates` (poblado desde env). Si no está mapeado pero el `template` es numérico, se usa directo. Templates HTML viven en el panel de Brevo (no como archivos en repo).
- [x] **8.4** Subscriber `src/subscribers/order-placed-email.ts` resuelve `Modules.NOTIFICATION` y llama `createNotifications` con datos de orden (display_id, items, totales, shipping_address) leídos vía `query.graph`. Errores se loggean sin propagar para no bloquear ruteo de fulfillment.
- [x] **8.5** Módulo `src/modules/brevo-contacts/` (servicio thin sobre `@getbrevo/brevo`, sin modelos): `upsertContact` (createContact + `updateEnabled: true`), `deleteContact`, `addToList` / `removeFromList`, `getListContacts` (pagina 500/página). Opciones `default_list_id` + `segments: Record<string, number>` (poblado en `medusa-config.ts` desde envs `BREVO_LIST_<NOMBRE>`). Subscriber `customer-brevo-sync.ts` en `customer.created` / `customer.updated` upserta con FNAME/LNAME a la lista default (skip silencioso si el módulo no está cargado). El placeholder de `notify-flash-activation` ahora resuelve recipients vía `getListContacts` cuando el módulo está cargado y `notification_segment` mapea a una lista; fallback al query de customers cuando no.
- [x] **8.6** Smoke test: script `src/scripts/smoke-brevo.ts` (correr con `TEST_EMAIL=… npx medusa exec ./src/scripts/smoke-brevo.ts`) que envía 1 email transaccional + upsert de contacto + verifica que aparece en la lista default. Tests unitarios `src/modules/brevo-contacts/__tests__/service.unit.spec.ts` con SDK mockeado (9 casos: validación, upsert con/sin lista, paginación, dedup por email vacío, addToList/removeFromList/deleteContact, resolveSegmentListId).

**Criterio de hecho**: una orden colocada dispara email de confirmación al cliente.

---

## Fase 9 — Pagos

**Objetivo**: 3 payment providers independientes (transferencia manual, PayPhone, DeUna) con rollout por fases según D11.

**Estrategia de rollout**: solo el provider de transferencia manual está activo al lanzamiento. PayPhone y DeUna se desarrollan en paralelo pero se mantienen DESACTIVADOS en la config de región hasta que cada contrato cierre. Activar es un cambio de una línea en `medusa-config.ts`.

### 9.A — Transferencia manual (bloqueante para go-live)

- [x] **9.A.1** Provider `src/modules/payment-bank-transfer/` (`AbstractPaymentProvider`, identifier `bank-transfer`). `initiatePayment` retorna status `PENDING` con `data.status="awaiting_payment"`, `reference_suffix` (3 bytes hex), referencia provisional `RP-PENDING-<6hex>` y `bank_account` (account_name/number/bank/ruc desde envs). `authorizePayment` retorna `AUTHORIZED` para que la orden se pueda colocar; `capturePayment` marca `data.status="paid"`+`captured_at`; `cancelPayment` marca `data.status="rejected"`+`rejected_at`. Helpers puros `buildPendingReference` / `buildFinalReference` exportados (referencia final `RP-<display_id>-<suffix>` se construye al enviar la notificación, ya con el `display_id`).
- [x] **9.A.2** `POST /store/orders/:id/payment-proof` (`src/api/store/orders/[id]/payment-proof/route.ts`) + middleware multer en `src/api/middlewares.ts` (memoryStorage, límite 10 MB, mime jpeg/png/webp/pdf). Valida `email` del body contra `order.email`, sube vía `uploadFilesWorkflow` (acceso `private`) y persiste `proof_file_id`/`proof_file_url`/`proof_uploaded_at`/`reference` en `order.metadata.bank_transfer`. Dispara notificación `bank-transfer-proof-received` (skip silencioso si `Modules.NOTIFICATION` no está cargado).
- [x] **9.A.3** Endpoints admin `GET /admin/bank-transfers?status=pending|captured|rejected|all`, `POST /admin/bank-transfers/:id/confirm` (llama `paymentModule.capturePayment` con el `payment.amount`) y `POST /admin/bank-transfers/:id/reject` (body `{ reason? }`, llama `cancelPayment`, persiste `rejection_reason` en metadata). UI Admin en `src/admin/routes/bank-transfers/page.tsx` (sidebar "Transferencias", icon `CreditCard`): tabs Pendientes/Confirmados/Rechazados, link al comprobante, botones confirmar/rechazar con input de motivo opcional. Cada acción dispara la notificación correspondiente.
- [x] **9.A.4** Subscriber `src/subscribers/bank-transfer-instructions.ts` en `order.placed`: si la orden tiene payment con provider `bank-transfer`, calcula la referencia final, la persiste en `order.metadata.bank_transfer.reference` y envía template `bank-transfer-instructions` (con monto, banco, referencia). Templates Brevo agregados al mapping en `medusa-config.ts`: `bank-transfer-instructions`, `bank-transfer-proof-received`, `bank-transfer-confirmed`, `bank-transfer-rejected` (env `BREVO_TEMPLATE_BANK_TRANSFER_*`).
- [x] **9.A.5** Provider registrado en `medusa-config.ts` bajo `@medusajs/medusa/payment` (sólo si `BANK_TRANSFER_ACCOUNT_NUMBER` está seteado, mismo patrón que Brevo). También se registra `@medusajs/medusa/file` con `@medusajs/file-local` para los comprobantes. `src/scripts/seed.ts` asocia el provider a la región Ecuador (`pp_bank-transfer_bank-transfer`) cuando el env está presente; si no, sigue usando `pp_system_default`.
- [x] **9.A.6** Tests: `src/modules/payment-bank-transfer/__tests__/service.unit.spec.ts` (13 escenarios sobre helpers de referencia, `validateOptions`, `initiatePayment`, authorize/capture/cancel/refund, `getPaymentStatus`, webhook). `npx tsc --noEmit` limpio. Tests integration de aprobar/rechazar end-to-end pendientes (requieren orden real con payment colection, igual que el resto de tests integration del proyecto).

**Criterio de hecho 9.A**: cliente puede checkout, subir comprobante, y admin verificar manualmente. Tienda puede operar con solo este método.

### 9.B — PayPhone (activar cuando contrato cierre)

- [ ] **9.B.1** Provider `payment-payphone` como módulo Medusa v2.
  - Soporta dos métodos: tarjeta (link/widget) y QR (PayPhone QR).
  - Webhook handler `POST /webhooks/payphone` para confirmar pago.
  - Manejo de status: pendiente → autorizado → capturado → reembolsado.
- [ ] **9.B.2** Configuración por env (`PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID`, etc.).
- [ ] **9.B.3** Integración con Fase 8 (notificaciones de pago).
- [ ] **9.B.4** Tests: simular webhook de pago aprobado, rechazado, reembolsado.
- [ ] **9.B.5** **NO activar todavía** en `medusa-config.ts`. Solo prender cuando el contrato cierre + credenciales productivas.

**Criterio de hecho 9.B**: módulo testeado en sandbox de PayPhone, listo para activar con un cambio de config.

### 9.C — DeUna API directa (activar cuando contrato cierre)

- [ ] **9.C.1** Provider `payment-deuna` como módulo Medusa v2.
  - Genera QR dinámico vía API de DeUna (Banco Pichincha).
  - Webhook handler `POST /webhooks/deuna` para confirmar.
- [ ] **9.C.2** Configuración por env (credenciales DeUna).
- [ ] **9.C.3** Integración con Fase 8.
- [ ] **9.C.4** Tests en sandbox DeUna.
- [ ] **9.C.5** **NO activar todavía** en `medusa-config.ts`.

**Criterio de hecho 9.C**: módulo testeado en sandbox DeUna, listo para activar con cambio de config.

### 9.D — Selección de método en checkout

- [ ] **9.D.1** Endpoint `GET /store/payment-methods` que devuelve solo los providers activos en la región.
- [ ] **9.D.2** Documentar en README cómo activar cada provider (variables env + entrada en `medusa-config.ts`).

---

## Riesgos y temas abiertos

- **Costo IA**: definir presupuesto mensual antes de Fase 7. Implementar circuit breaker.
- **Datos INEC**: confirmar dataset oficial antes de Fase 1.2.
- **Contratos PayPhone y DeUna**: 9.B y 9.C se desarrollan completos pero solo se activan al cierre de cada contrato. Mantener checklist separado de credenciales productivas pendientes.
- **Storefront**: ¿quién lo construye? ¿Next.js? ¿Mismo equipo? — fuera de alcance de este backend pero afecta APIs.

---

## Bitácora de cambios al plan

| Fecha | Cambio | Razón |
|---|---|---|
| 2026-04-25 | Documento inicial | Plan acordado tras sesión de aterrizaje de decisiones |
| 2026-04-25 | Agregadas D9–D11 (solo backend, Brevo, PayPhone+transferencia). Nuevas Fases 8 (Notificaciones) y 9 (Pagos) | Cierre de temas abiertos. Modalidad QR de D11 sigue pendiente. |
| 2026-04-25 | D11 cerrado: 3 providers (PayPhone + DeUna + transferencia manual) con rollout por fases. Fase 9 dividida en 9.A (manual, bloqueante go-live), 9.B (PayPhone), 9.C (DeUna), 9.D (selección). | Permite lanzar con transferencia manual mientras se cierran contratos con PayPhone y DeUna. |
| 2026-04-26 | Fase 0 completada (0.1–0.6). Stack: Medusa v2.14.0, Postgres 17, Redis 7. Monorepo del template aplanado a raíz. `legacy-peer-deps=true` en `.npmrc` por conflicto react 18/19 entre paquetes Medusa. | Bootstrap del proyecto. |
| 2026-04-26 | Fase 1 completada. Módulo `geography` con `Province`/`Canton`, seed INEC (24 + 221) y endpoints store. Cantones hardcodeados (opción b) en lugar de descargar dataset INEC en runtime. | Evita dependencia de URLs externas; el DPA es estable y los cambios futuros son PRs puntuales. |
| 2026-04-26 | Fase 2 completada. Módulo `warehouse-routing` con `WarehouseServiceArea`, links a StockLocation y Canton, CRUD admin, seed Quito+Guayaquil (442 service areas) y tests integration:modules. | Base para el ruteo geográfico de fulfillment. |
| 2026-04-26 | Fase 4 completada. Módulo `order-routing` (`OrderRouting` 1:1 a Order vía link, `OrderRoutingShipment` hasMany). Workflows `suggest-warehouse` y `route-fulfillment` con steps separados (carga input, computa plan, persiste, reemplaza reservaciones). Algoritmo extraído a función pura `buildRoutingPlan` para tests unitarios de los 4 escenarios sin DB. Subscriber a `order.placed`. Endpoint `POST /store/cart/shipping-preview`. Decidido D12: la fase 4 NO crea Fulfillments automáticos (solo persiste ruteo + reservaciones); fallback unified sin bodega completa = `requires_manual_routing`. Cantón destino se lee de `shipping_address.metadata.canton_id`. | Habilita ruteo automático en checkout y al confirmar orden, manteniendo control humano sobre el despacho físico. |
| 2026-04-26 | Fase 3 completada. Módulo `product-shipping-rules` con flag `requires_unified_shipment` (1 fila por producto, link 1:1 a Product). Endpoint admin upsert + widget Admin UI con Switch. Decidido módulo separado en lugar de extender Product directamente: Medusa v2 no permite agregar columnas a entidades core, y el module link mantiene el aislamiento de D-arquitectura. | Habilita el flag para el ruteo de Fase 4. |
| 2026-04-30 | Fase 6 completada. Módulo `flash-promotion` (link 1:1 a Promotion nativo). Atomicidad implementada con `UPDATE ... WHERE units_sold + qty <= units_limit RETURNING` directo contra el EntityManager (sin transacción de Mikro), validado con test de 20 increments concurrentes. Decisión de ejecución: `order.placed` (subscriber dispara workflow `decrement-flash-units` que también desactiva la promo nativa al alcanzar límite). Activación de emails y expiración corren en cron `* * * * *` (`expire-flash-promotions`). Resolución de segmentos para emails es placeholder hasta Fase 8.5 (sync customers ↔ listas Brevo). | Habilita flash sales con countdown + límite global atómico. |
| 2026-04-30 | Fase 8.1–8.4 completadas (adelantadas antes de Fase 6 porque 6.6 envía emails). Módulo `notification-brevo` con `@getbrevo/brevo` v5. Provider opt-in via `BREVO_API_KEY` env (si no está seteado, no se carga el módulo de notificaciones — evita romper dev/test). Subscriber `order-placed-email` ya activo. Falta 8.5 (sync customers ↔ listas Brevo) y 8.6 (smoke test real). | Habilita el envío de emails que requiere Fase 6.6 (activar flash promo). |
| 2026-05-01 | Fase 7 completada. Módulo `ai-assistant` con `Conversation`/`Message`/`ProductEmbedding`. Stack confirmado: Claude Haiku 4.5 (chat) + Voyage AI `voyage-3-lite` 512 dims (embeddings, vía HTTP directo) + pgvector con índice ivfflat cosine. Workflows `embed-product` y `chat-respond` (5 steps, RAG top-5, prompt caching del system prompt fijo). Endpoint `POST /store/chat/messages` con rate limit por hora vía módulo cache (20/h IP, 60/h customer) y log de tokens. Subscribers en `product.created/updated/deleted` mantienen sincronizada la tabla de embeddings. 11 unit tests nuevos (todos verdes), 4 integration tests pendientes de ejecutar (requieren extensión vector en DB de test). | Cierra Fase 7 — chat IA libre con RAG sobre catálogo real, manteniendo la separación módulo / workflow / endpoint y sin acoplar el módulo a credenciales (skip silencioso si falta `VOYAGE_API_KEY` o `ANTHROPIC_API_KEY`). |
| 2026-05-01 | Fase 8.5–8.6 completadas. Nuevo módulo `brevo-contacts` (servicio thin, sin modelos) loadeado solo si `BREVO_API_KEY` está seteado; expone upsert/delete/list-contacts y resuelve segmentos simbólicos vía env `BREVO_LIST_<NOMBRE>`. Subscriber sync customer→Brevo en `customer.created`/`customer.updated`. `notify-flash-activation` ahora consume listas Brevo cuando hay segmento, eliminando el placeholder de Fase 6.6. Smoke test manual via `src/scripts/smoke-brevo.ts`. | Cierra Fase 8 y conecta el flujo de flash-promo con segmentación real de listas. |
| 2026-05-01 | Fase 9.A completada. Provider `payment-bank-transfer` con referencia `RP-<display_id>-<6 hex>` (suffix generado en initiate, display_id resuelto al enviar la notificación post-`order.placed`). Datos bancarios via envs `BANK_TRANSFER_*`; provider opt-in (no se carga si la cuenta no está seteada). Upload de comprobantes con multer + `uploadFilesWorkflow` (acceso `private`) y `@medusajs/file-local` registrado. Admin UI en `/admin/bank-transfers` (lista por estado + confirmar/rechazar) usa `paymentModule.capturePayment`/`cancelPayment` directo. 4 templates Brevo nuevos (`bank-transfer-instructions/proof-received/confirmed/rejected`). Seed actualizado para asociar el provider a la región Ecuador cuando esté configurado. 13 unit tests verdes. | Habilita lanzamiento de la tienda con transferencia bancaria manual sin depender de contratos PayPhone/DeUna (D11). |
| 2026-04-29 | Fase 5 completada (D13 nueva). Módulo `product-pack` con `ProductPack`/`PackItem`, link 1:1 a Product, admin endpoint upsert + delete. Integración con fulfillment vía expansión pura `expandPackItems` dentro de `compute-routing-plan`: si una variante del input es de un Product que tiene ProductPack, se reemplaza por sus componentes (qty×qty, mismo line_item_id) antes de buildRoutingPlan, y se fuerza `requires_unified_shipment=true` para todos. Reservaciones aterrizan en componentes vía `replace-order-reservations` existente — no hizo falta workflow `reserve-pack-inventory` separado. Stock del pack se calcula on-the-fly desde el componente más escaso (no se mantiene inventario propio). | Permite vender productos compuestos sin duplicar contadores de stock y aprovechando pricing/SEO/imágenes nativos de Product. |
