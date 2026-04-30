import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  notifyFlashActivationStep,
  type NotifyFlashActivationInput,
  type NotifyFlashActivationResult,
} from "./steps/notify-flash-activation"

export const activateFlashPromotionWorkflowId = "activate-flash-promotion"

export const activateFlashPromotionWorkflow = createWorkflow(
  activateFlashPromotionWorkflowId,
  (
    input: NotifyFlashActivationInput
  ): WorkflowResponse<NotifyFlashActivationResult> => {
    const result = notifyFlashActivationStep(input)
    return new WorkflowResponse(result)
  }
)
