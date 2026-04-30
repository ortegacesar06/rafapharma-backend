import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  decrementFlashUnitsStep,
  type DecrementFlashUnitsInput,
  type DecrementFlashUnitsResult,
} from "./steps/decrement-flash-units"

export const decrementFlashUnitsWorkflowId = "decrement-flash-units"

export const decrementFlashUnitsWorkflow = createWorkflow(
  decrementFlashUnitsWorkflowId,
  (
    input: DecrementFlashUnitsInput
  ): WorkflowResponse<DecrementFlashUnitsResult> => {
    const result = decrementFlashUnitsStep(input)
    return new WorkflowResponse(result)
  }
)
