import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { routeFulfillmentWorkflow } from "../workflows/fulfillment";

export default async function routeOrderFulfillmentHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id;
  if (!orderId) return;

  const logger = container.resolve("logger");

  try {
    await routeFulfillmentWorkflow(container).run({
      input: { order_id: orderId },
    });
  } catch (err) {
    logger.error(
      `route-fulfillment failed for order ${orderId}: ${(err as Error).message}`
    );
    throw err;
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
