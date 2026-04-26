import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  logger.info("Seeding sales channel...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Default Sales Channel",
          description: "Canal de venta principal de Rafapharma",
        },
      ],
    },
  });

  logger.info("Seeding publishable API key...");
  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Storefront",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  logger.info("Seeding store (Rafapharma, USD)...");
  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Rafapharma",
          supported_currencies: [
            {
              currency_code: "usd",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region Ecuador...");
  await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Ecuador",
          currency_code: "usd",
          countries: ["ec"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });

  logger.info("Seeding tax region (EC)...");
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "ec",
        provider_id: "tp_system",
      },
    ],
  });

  logger.info(
    `Seed completo. Publishable API key: ${publishableApiKey.token}`
  );
}
