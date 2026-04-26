import {
  createWorkflow,
  WorkflowResponse,
  when,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { computeRoutingPlanStep } from "./steps/compute-routing-plan";
import { loadOrderRoutingInputStep } from "./steps/load-order-routing-input";
import { persistOrderRoutingStep } from "./steps/persist-order-routing";
import { replaceOrderReservationsStep } from "./steps/replace-order-reservations";

export type RouteFulfillmentInput = { order_id: string };

export const routeFulfillmentWorkflowId = "route-fulfillment";

export const routeFulfillmentWorkflow = createWorkflow(
  routeFulfillmentWorkflowId,
  (input: RouteFulfillmentInput) => {
    const routingInput = loadOrderRoutingInputStep({ order_id: input.order_id });
    const plan = computeRoutingPlanStep(routingInput);

    persistOrderRoutingStep({ order_id: input.order_id, plan });

    const isRoutable = transform({ plan }, ({ plan }) => plan.routable);

    when({ isRoutable }, ({ isRoutable }) => isRoutable).then(() => {
      replaceOrderReservationsStep({ order_id: input.order_id, plan });
    });

    return new WorkflowResponse({ plan });
  }
);
