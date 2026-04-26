import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { computeRoutingPlanStep } from "./steps/compute-routing-plan";
import type { SuggestWarehouseInput, SuggestWarehouseOutput } from "./types";

export const suggestWarehouseWorkflowId = "suggest-warehouse";

export const suggestWarehouseWorkflow = createWorkflow(
  suggestWarehouseWorkflowId,
  (input: SuggestWarehouseInput) => {
    const plan = computeRoutingPlanStep(input);
    return new WorkflowResponse<SuggestWarehouseOutput>(plan);
  }
);
