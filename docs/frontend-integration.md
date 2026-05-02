# Integración con frontend (Angular / React / cualquier SPA)

Este backend es **headless**: solo expone APIs REST. El Admin UI que viene en `/app` es independiente del storefront público; tu frontend es un proyecto separado que consume estas APIs y maneja todo el diseño.

---

## 1. Configuración inicial

### 1.1 CORS

Agregar el origen del frontend a `STORE_CORS` en `.env` (lista separada por comas):

```env
STORE_CORS=http://localhost:4200,https://tienda.rafapharma.ec
AUTH_CORS=http://localhost:4200,https://tienda.rafapharma.ec,http://localhost:9000
```

`AUTH_CORS` debe incluir tanto los orígenes del storefront como los del Admin (`http://localhost:9000`).

### 1.2 Publishable API Key

Toda request a `/store/*` debe incluir el header:

```
x-publishable-api-key: pk_xxxxx...
```

La key se genera con el seed (`npm run seed`); también se puede crear/rotar desde el Admin en **Settings → Publishable API Keys**.

#### ¿Es seguro exponerla en el bundle del frontend?

**Sí, es pública por diseño** — mismo modelo que la publishable key de Stripe (`pk_live_...`), la anon key de Supabase, o la API key de Mapbox.

**Para qué sirve**:
- Identifica qué *sales channel* (catálogo) está consultando el frontend. Permite tener múltiples tiendas (B2C, B2B, móvil) sobre el mismo backend.
- Se puede rotar/revocar desde el Admin sin redeploy del backend.

**Lo que NO permite** (importante):
- ❌ No autoriza acceso a datos de un customer sin login.
- ❌ No autoriza endpoints `/admin/*`.
- ❌ No es contraseña — no protege secretos.

**Lo que sí debe quedar SOLO en el backend** (nunca en el bundle del frontend):
- `JWT_SECRET`, `COOKIE_SECRET`
- `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`
- `BREVO_API_KEY`
- `BANK_TRANSFER_*`
- Credenciales de DB / Redis
- Credenciales de PayPhone / DeUna (cuando se prendan)

---

## 2. Modelo de autenticación

| Recurso | Cómo se autentica |
|---|---|
| Catálogo público (`/store/products`, `/store/regions`, `/store/provinces`, etc.) | Solo `x-publishable-api-key` |
| Carrito anónimo (`/store/carts`) | Solo `x-publishable-api-key` (el `cart_id` se guarda en cliente) |
| Datos del customer logueado (`/store/customers/me`, `/store/orders`) | `Authorization: Bearer <jwt>` del customer |
| Admin (`/admin/*`) | Sesión / JWT de admin user |

### 2.1 Login del customer

```http
POST /auth/customer/emailpass
Content-Type: application/json

{ "email": "user@ejemplo.com", "password": "..." }
```

Respuesta: `{ "token": "<jwt>" }` — guardarlo en `localStorage`/`sessionStorage` y enviarlo en el header `Authorization` para requests subsiguientes.

### 2.2 Registro

```http
POST /auth/customer/emailpass/register
{ "email": "...", "password": "..." }
```

Luego:

```http
POST /store/customers
Authorization: Bearer <jwt-del-register>
{ "first_name": "...", "last_name": "...", "email": "..." }
```

### 2.3 SDK oficial

Medusa publica `@medusajs/js-sdk` (framework-agnóstico, funciona en Angular, React, Vue, Svelte). Maneja headers, JWT y cart id automáticamente. Alternativa: usar `fetch` / `HttpClient` directo.

```ts
import Medusa from "@medusajs/js-sdk"

const sdk = new Medusa({
  baseUrl: "https://api.rafapharma.ec",
  publishableKey: import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY,
})

const { products } = await sdk.store.product.list()
```

---

## 3. Mapa completo de endpoints

Hay **tres familias** de endpoints expuestos por este backend:

1. **Store API nativa** de Medusa (`/store/*`) — para el storefront público / customer.
2. **Admin API nativa** de Medusa (`/admin/*`) — para construir un Admin dashboard custom.
3. **Endpoints custom de este proyecto** (`/store/*` y `/admin/*`) — específicos de Rafapharma.

Las nativas se documentan oficialmente en https://docs.medusajs.com/api/store y https://docs.medusajs.com/api/admin (con OpenAPI navegable). Aquí solo enumero las que típicamente vas a necesitar al construir el storefront y un dashboard custom; sigue la doc oficial para parámetros y schemas exactos.

### 3.1 Store API nativa (necesarias para el storefront)

Header obligatorio en todas: `x-publishable-api-key: pk_...`. Las que requieren customer logueado: `Authorization: Bearer <jwt>` además.

#### Auth de customer
| Método | Path | Para qué |
|---|---|---|
| POST | `/auth/customer/emailpass/register` | Registro inicial (devuelve JWT temporal) |
| POST | `/auth/customer/emailpass` | Login (devuelve JWT) |
| POST | `/auth/customer/emailpass/update` | Cambiar password |
| POST | `/auth/token/refresh` | Refrescar JWT |
| DELETE | `/auth/session` | Logout |

#### Customer
| Método | Path | Auth |
|---|---|---|
| POST | `/store/customers` | JWT (post-register) — crea el perfil |
| GET | `/store/customers/me` | JWT |
| POST | `/store/customers/me` | JWT — actualizar datos |
| GET | `/store/customers/me/addresses` | JWT |
| POST | `/store/customers/me/addresses` | JWT |
| POST/DELETE | `/store/customers/me/addresses/:id` | JWT |

#### Catálogo (público)
| Método | Path | Para qué |
|---|---|---|
| GET | `/store/regions` | Lista de regiones (Ecuador) |
| GET | `/store/regions/:id` | Detalle región — incluye `payment_providers` activos |
| GET | `/store/products` | Lista paginada con filtros (`q`, `category_id`, `tag_id`, `collection_id`, `sales_channel_id`, etc.) |
| GET | `/store/products/:id` | Detalle producto + variants |
| GET | `/store/product-categories` | Árbol de categorías |
| GET | `/store/product-categories/:id` | Detalle categoría |
| GET | `/store/collections` | Colecciones |
| GET | `/store/shipping-options` | Opciones de envío para un cart |
| GET | `/store/currencies` | Monedas disponibles |

> Para que el catálogo se muestre, en cada request de productos pasar el `sales_channel_id` (asociado a la publishable key) o dejar que la key lo resuelva automáticamente.

#### Carrito y checkout
| Método | Path | Para qué |
|---|---|---|
| POST | `/store/carts` | Crear cart (con `region_id`, `currency_code`, opcionalmente `email`, `sales_channel_id`) |
| GET | `/store/carts/:id` | Recuperar cart |
| POST | `/store/carts/:id` | Actualizar cart (email, addresses, region) |
| POST | `/store/carts/:id/line-items` | Agregar producto |
| POST | `/store/carts/:id/line-items/:line_id` | Cambiar cantidad |
| DELETE | `/store/carts/:id/line-items/:line_id` | Quitar |
| POST | `/store/carts/:id/promotions` | Aplicar código promo |
| DELETE | `/store/carts/:id/promotions` | Remover códigos |
| POST | `/store/carts/:id/taxes` | Recalcular impuestos |
| POST | `/store/carts/:id/shipping-methods` | Elegir método de envío |
| POST | `/store/carts/:id/customer` | Asociar customer logueado al cart |
| POST | `/store/carts/:id/complete` | Finalizar y crear `order` |

#### Payment collections
| Método | Path | Para qué |
|---|---|---|
| POST | `/store/payment-collections` | Crear payment collection para un cart |
| POST | `/store/payment-collections/:id/payment-sessions` | Iniciar sesión con un provider (ej. `pp_bank-transfer_bank-transfer`) |
| DELETE | `/store/payment-collections/:id/payment-sessions/:sid` | Cambiar de provider |

#### Órdenes del customer
| Método | Path | Auth |
|---|---|---|
| GET | `/store/orders` | JWT — lista paginada |
| GET | `/store/orders/:id` | JWT — detalle |
| POST | `/store/orders/:id/transfer/request` | JWT — reclamar orden de invitado |
| POST | `/store/orders/:id/transfer/accept` | JWT |

#### Returns / RMAs
| Método | Path | Para qué |
|---|---|---|
| GET | `/store/return-reasons` | Motivos de devolución |
| POST | `/store/return` | Solicitar devolución |

---

### 3.2 Admin API nativa (necesarias para un dashboard custom)

Header obligatorio: cookie de sesión (default) o `Authorization: Bearer <admin-jwt>`. Login en `/auth/user/emailpass`.

> El Admin UI que viene en `/app` ya cubre todo esto. Solo necesitas reimplementarlo si vas a construir un dashboard 100% custom para Rafapharma. Si prefieres extender el Admin nativo, mejor agregar widgets/routes en `src/admin/` (ya hay ejemplos: `flash-promotion.tsx`, `bank-transfers/page.tsx`, etc.).

#### Auth de admin
| Método | Path |
|---|---|
| POST | `/auth/user/emailpass` (login → JWT) |
| POST | `/auth/user/emailpass/register` (solo primer setup) |
| GET | `/admin/users/me` |

#### Catálogo
- `GET/POST /admin/products`, `GET/POST/DELETE /admin/products/:id`
- `POST /admin/products/:id/variants`, `POST/DELETE /admin/products/:id/variants/:vid`
- `POST /admin/products/import`, `POST /admin/products/export`
- `GET/POST /admin/product-categories`, `GET/POST/DELETE /admin/product-categories/:id`
- `GET/POST /admin/collections`
- `GET/POST/DELETE /admin/product-tags`
- `GET/POST /admin/product-types`

#### Inventario
- `GET/POST /admin/inventory-items`, `GET/POST/DELETE /admin/inventory-items/:id`
- `POST /admin/inventory-items/:id/location-levels` — stock por bodega
- `GET/POST /admin/stock-locations`, `GET/POST/DELETE /admin/stock-locations/:id` — bodegas
- `POST /admin/reservations`

#### Órdenes y fulfillment
- `GET /admin/orders` (filtros: `status`, `payment_status`, `fulfillment_status`, `customer_id`, etc.)
- `GET/POST /admin/orders/:id`
- `POST /admin/orders/:id/fulfillments` — crear fulfillment manual
- `POST /admin/orders/:id/fulfillments/:fid/shipment` — marcar enviado
- `POST /admin/orders/:id/cancel`
- `POST /admin/orders/:id/refund`
- `POST /admin/orders/:id/payments/:pid/capture` — confirmar pago
- `POST /admin/orders/:id/payments/:pid/refund`
- `GET /admin/draft-orders`, `POST /admin/draft-orders` — órdenes manuales

#### Customers
- `GET/POST /admin/customers`, `GET/POST/DELETE /admin/customers/:id`
- `GET/POST /admin/customer-groups` — segmentación

#### Promociones y campañas
- `GET/POST /admin/promotions`, `GET/POST/DELETE /admin/promotions/:id`
- `POST /admin/promotions/:id/rules`, `/buy-rules`, `/target-rules`
- `GET/POST /admin/campaigns` — agrupan promociones con ventana temporal

#### Pricing
- `GET/POST /admin/price-lists` — listas de precios por segmento
- `GET/POST /admin/pricing/price-rules`

#### Configuración de la tienda
- `GET/POST /admin/regions`, `/admin/regions/:id` — regiones, monedas, providers de pago
- `GET/POST /admin/sales-channels`
- `GET/POST /admin/shipping-profiles`
- `GET/POST /admin/shipping-options`
- `GET/POST /admin/fulfillment-sets`, `/service-zones` — qué bodega cubre qué zona (lo de Rafapharma se complementa con el endpoint custom de service-areas, ver 3.4)
- `GET/POST /admin/tax-regions`, `/tax-rates`
- `GET/POST /admin/api-keys` — admin keys + publishable keys
- `GET/POST /admin/store` — config de la tienda

#### Files / uploads
- `POST /admin/uploads` (multipart, campo `files`) — subir imágenes/archivos al provider de file
- `GET /admin/uploads/:id`
- `DELETE /admin/uploads/:id`

#### Workflows e invocaciones
- `GET /admin/workflows-executions` — auditoría
- `POST /admin/workflows-executions/:name/run` — ejecutar workflows manualmente

#### Notificaciones
- `GET /admin/notifications` — historial de envíos

#### Users (admin)
- `GET/POST /admin/users`, `GET/POST/DELETE /admin/users/:id`
- `GET/POST /admin/invites` — invitar admins

> Lista completa con schemas y ejemplos por endpoint: https://docs.medusajs.com/api/admin

---

### 3.3 Endpoints custom — Store (`/store/*`)

Adicionales a las Store APIs estándar de Medusa:

#### 3.3.1 Geografía (Fase 1)

```http
GET /store/provinces
GET /store/provinces/:id/cantons
```

Para armar dropdowns provincia → cantón en el formulario de dirección. El `canton_id` debe guardarse en `shipping_address.metadata.canton_id` al crear la dirección — eso es lo que el ruteo de fulfillment lee.

Respuesta `/store/provinces`:
```json
{ "provinces": [{ "id": "...", "name": "Pichincha", "code": "17" }, ...] }
```

#### 3.3.2 Preview de envío (Fase 4)

```http
POST /store/cart/shipping-preview
{ "cart_id": "cart_xxx" }
```

O alternativa explícita:
```json
{ "canton_id": "...", "items": [{ "variant_id": "...", "quantity": 2 }] }
```

Devuelve qué bodega(s) despacharía la orden y el recargo. Útil para mostrar al cliente el costo antes del checkout.

#### 3.3.3 Flash promotions activas (Fase 6)

```http
GET /store/flash-promotions/active
```

Devuelve solo las promos en ventana, no agotadas, con `time_remaining_seconds` y `units_remaining` para el countdown.

Respuesta:
```json
{
  "flash_promotions": [
    {
      "id": "...",
      "promotion_id": "...",
      "code": "FLASH50",
      "campaign_name": "Black Friday",
      "starts_at": "2026-05-01T00:00:00.000Z",
      "ends_at": "2026-05-02T00:00:00.000Z",
      "time_remaining_seconds": 86400,
      "units_limit": 100,
      "units_sold": 23,
      "units_remaining": 77
    }
  ]
}
```

#### 3.3.4 Chat IA (Fase 7)

```http
POST /store/chat/messages
{ "conversation_id": "<opcional>", "message": "Recomiéndame algo para post-entreno" }
```

Devuelve `{ conversation_id, message, usage: { input_tokens, output_tokens } }`.

Rate limit: 20/h por IP, 60/h por customer logueado.

#### 3.3.5 Subir comprobante de transferencia (Fase 9.A)

```http
POST /store/orders/:id/payment-proof
Content-Type: multipart/form-data

file: <archivo jpeg/png/webp/pdf, máx 10 MB>
email: <email del customer que coincide con order.email>
```

Devuelve `{ proof_file_url, reference, proof_uploaded_at }`. La referencia es `RP-<display_id>-<6 hex>` y debe mostrarse al cliente para que la incluya en la transferencia bancaria.

---

### 3.4 Endpoints custom — Admin (`/admin/*`)

Todos requieren auth de admin (cookie de sesión o `Authorization: Bearer <admin-jwt>`). Si construyes un dashboard custom, estos son los endpoints específicos de Rafapharma; si vas a extender el Admin nativo, ya hay widgets/routes en `src/admin/` para cada uno.

#### 3.4.1 Warehouse service areas (Fase 2)

Mapeo bodega ↔ cantón con prioridad y recargo. La UI nativa de Medusa no cubre esta relación; se gestiona con estos endpoints.

| Método | Path | Body / Query |
|---|---|---|
| GET | `/admin/warehouse-service-areas` | Query: `stock_location_id?`, `canton_id?` |
| POST | `/admin/warehouse-service-areas` | `{ stock_location_id, canton_id, priority?=100, surcharge_amount?=0 }` |
| GET | `/admin/warehouse-service-areas/:id` | — |
| POST | `/admin/warehouse-service-areas/:id` | `{ priority?, surcharge_amount?, stock_location_id?, canton_id? }` |
| DELETE | `/admin/warehouse-service-areas/:id` | — |

#### 3.4.2 Product shipping rules (Fase 3)

Flag `requires_unified_shipment` por producto.

| Método | Path | Body |
|---|---|---|
| GET | `/admin/products/:id/shipping-rule` | — |
| POST | `/admin/products/:id/shipping-rule` | `{ requires_unified_shipment: boolean }` |

Hace upsert (crea el link Product↔ProductShippingRule en el primer POST).

#### 3.4.3 Product packs (Fase 5)

Producto compuesto con BOM (lista de variantes + cantidades).

| Método | Path | Body |
|---|---|---|
| GET | `/admin/products/:id/pack` | — — devuelve `{ pack: { id, items: [...] } | null }` |
| POST | `/admin/products/:id/pack` | `{ items: [{ variant_id, quantity }] }` — reemplaza items completos |
| DELETE | `/admin/products/:id/pack` | — quita el pack del producto |

Validaciones: `items` no vacío, cada `quantity >= 1`, `variant_id` requerido.

#### 3.4.4 Flash promotions (Fase 6)

Extiende una `Promotion` nativa con límite global de unidades + activación con email.

| Método | Path | Body |
|---|---|---|
| GET | `/admin/promotions/:id/flash` | — |
| POST | `/admin/promotions/:id/flash` | `{ units_limit?: number\|null, notify_on_activate?: boolean, notification_segment?: string\|null }` |
| DELETE | `/admin/promotions/:id/flash` | — |

`notification_segment` es el nombre simbólico (lowercase) que mapea a `BREVO_LIST_<NAME>`. `units_limit` debe ser entero positivo o null (sin límite).

#### 3.4.5 Bank transfer verification (Fase 9.A)

| Método | Path | Body / Query |
|---|---|---|
| GET | `/admin/bank-transfers` | Query: `status=pending\|captured\|rejected\|all` (default `pending`). Devuelve `{ orders, count }` con órdenes que tienen payment de provider `bank-transfer` filtradas por estado |
| POST | `/admin/bank-transfers/:order_id/confirm` | — — captura el pago, dispara notificación `bank-transfer-confirmed` |
| POST | `/admin/bank-transfers/:order_id/reject` | `{ reason?: string }` — cancela el pago, persiste motivo en `order.metadata.bank_transfer.rejection_reason`, dispara notificación `bank-transfer-rejected` |

---

## 4. Flujo de checkout end-to-end

1. **Crear/recuperar carrito**: `POST /store/carts` (incluir `region_id` de Ecuador y la `currency_code`).
2. **Agregar items**: `POST /store/carts/:id/line-items`.
3. **Set shipping address con cantón**: `POST /store/carts/:id`
   ```json
   {
     "shipping_address": {
       "first_name": "...", "last_name": "...",
       "address_1": "...", "city": "...",
       "country_code": "ec",
       "metadata": { "canton_id": "<canton_id>" }
     }
   }
   ```
4. **(Opcional) Preview de envío**: `POST /store/cart/shipping-preview`.
5. **Set shipping method**: `POST /store/carts/:id/shipping-methods`.
6. **Iniciar payment session** con provider `bank-transfer`:
   ```http
   POST /store/payment-collections
   POST /store/payment-collections/:id/payment-sessions
   { "provider_id": "pp_bank-transfer_bank-transfer" }
   ```
7. **Completar carrito**: `POST /store/carts/:id/complete` → devuelve `order`.
8. **Mostrar al cliente** la referencia y datos bancarios (vienen en `order.payment_collections[0].payments[0].data.bank_account` + `data.reference_suffix`; el subscriber `bank-transfer-instructions` también envía email automático con esos datos).
9. **Cliente sube comprobante**: `POST /store/orders/:id/payment-proof` (paso 3.5).
10. Admin verifica y confirma desde `/app/bank-transfers`. La orden pasa a `paid`.

---

## 5. Campos personalizados sin tocar el backend

Casi todas las entidades de Medusa tienen un campo `metadata` (JSON libre): `customer`, `order`, `cart`, `address`, `product`, `line_item`. Usarlo para datos del frontend que no necesitan modelo dedicado:

```json
POST /store/customers
{
  "first_name": "...",
  "metadata": {
    "preferred_language": "es",
    "fitness_goal": "ganar-masa",
    "marketing_opt_in": true
  }
}
```

Para datos estructurados que requieren queries / índices / validaciones, crear un módulo + module link (mismo patrón que `product-shipping-rules`, `product-pack`, `flash-promotion`).

---

## 6. Variables del frontend (ejemplo)

```env
# .env del frontend (Angular/React/etc.)
MEDUSA_BACKEND_URL=https://api.rafapharma.ec
MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxxxxxxx
```

Solo estas dos. **Cualquier otra credencial vive en el backend.**

---

## 7. Producción — recordatorios

- `STORE_CORS` y `AUTH_CORS` deben incluir el dominio HTTPS del frontend.
- Rotar `JWT_SECRET` y `COOKIE_SECRET` (no usar los valores por defecto).
- Brevo activo → `BREVO_API_KEY` y los `BREVO_TEMPLATE_*` seteados en el panel.
- Bank transfer activo → `BANK_TRANSFER_ACCOUNT_NUMBER` (y demás `BANK_TRANSFER_*`) seteados; correr `npm run seed` para asociar el provider a la región Ecuador.
- HTTPS obligatorio en producción (los JWT viajan en `Authorization`).
- Si el storefront vive en otro dominio, considerar `cookies` con `SameSite=None; Secure` solo si se usa auth por cookie (por defecto este backend usa JWT en header, no cookies).
