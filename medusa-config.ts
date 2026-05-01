import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const parseTemplateId = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const brevoTemplates = Object.fromEntries(
  Object.entries({
    "order-placed": parseTemplateId(process.env.BREVO_TEMPLATE_ORDER_PLACED),
    "order-shipped": parseTemplateId(process.env.BREVO_TEMPLATE_ORDER_SHIPPED),
    "order-delivered": parseTemplateId(process.env.BREVO_TEMPLATE_ORDER_DELIVERED),
    "password-reset": parseTemplateId(process.env.BREVO_TEMPLATE_PASSWORD_RESET),
  }).filter(([, v]) => v !== undefined)
) as Record<string, number>;

const parseListId = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

const brevoSegments = Object.fromEntries(
  Object.entries(process.env)
    .filter(([k]) => k.startsWith("BREVO_LIST_"))
    .map(([k, v]) => [k.replace("BREVO_LIST_", "").toLowerCase().replace(/_/g, "-"), parseListId(v)])
    .filter(([, v]) => v !== undefined)
) as Record<string, number>;

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "./src/modules/geography",
    },
    {
      resolve: "./src/modules/warehouse-routing",
    },
    {
      resolve: "./src/modules/product-shipping-rules",
    },
    {
      resolve: "./src/modules/order-routing",
    },
    {
      resolve: "./src/modules/product-pack",
    },
    {
      resolve: "./src/modules/flash-promotion",
    },
    ...(process.env.BREVO_API_KEY
      ? [
          {
            resolve: "./src/modules/brevo-contacts",
            options: {
              api_key: process.env.BREVO_API_KEY,
              default_list_id: parseListId(process.env.BREVO_DEFAULT_LIST_ID),
              segments: brevoSegments,
            },
          },
        ]
      : []),
    ...(process.env.BREVO_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/notification",
            options: {
              providers: [
                {
                  resolve: "./src/modules/notification-brevo",
                  id: "brevo",
                  options: {
                    channels: ["email"],
                    api_key: process.env.BREVO_API_KEY,
                    from_email: process.env.BREVO_FROM_EMAIL,
                    from_name: process.env.BREVO_FROM_NAME,
                    reply_to_email: process.env.BREVO_REPLY_TO_EMAIL,
                    reply_to_name: process.env.BREVO_REPLY_TO_NAME,
                    templates: brevoTemplates,
                  },
                },
              ],
            },
          },
        ]
      : []),
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: { url: process.env.REDIS_URL },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: { redisUrl: process.env.REDIS_URL },
          },
        ],
      },
    },
  ],
});
