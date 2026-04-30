import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules, PromotionStatus } from "@medusajs/framework/utils"
import { FLASH_PROMOTION_MODULE } from "../../../modules/flash-promotion"
import type FlashPromotionModuleService from "../../../modules/flash-promotion/service"

export type FlashUnitsRequest = {
  /** Promotion id (from native promotion module) the order applied. */
  promotion_id: string
  /** Quantity to decrement (typically item count covered by the promo). */
  quantity: number
}

export type DecrementFlashUnitsInput = {
  /** Order id — used purely for idempotency tracing in logs. */
  order_id: string
  requests: FlashUnitsRequest[]
}

export type DecrementFlashUnitsResult = {
  applied: Array<{
    promotion_id: string
    quantity: number
    units_sold: number
    units_limit: number | null
  }>
  rejected: string[]
  /** Promotions whose limit was reached and that we deactivated in the native module. */
  deactivated: string[]
}

export const decrementFlashUnitsStepId = "decrement-flash-units"

export const decrementFlashUnitsStep = createStep(
  decrementFlashUnitsStepId,
  async (
    input: DecrementFlashUnitsInput,
    { container }
  ): Promise<StepResponse<DecrementFlashUnitsResult, DecrementFlashUnitsResult | null>> => {
    if (!input.requests?.length) {
      return new StepResponse({ applied: [], rejected: [], deactivated: [] }, null)
    }

    const service: FlashPromotionModuleService = container.resolve(
      FLASH_PROMOTION_MODULE
    )
    const logger = container.resolve("logger")

    const applied: DecrementFlashUnitsResult["applied"] = []
    const rejected: string[] = []
    const deactivated: string[] = []

    for (const req of input.requests) {
      const flashList = await service.listFlashPromotions({
        promotion_id: req.promotion_id,
      })
      if (!flashList.length) continue

      const row = await service.tryIncrementUnitsSold(req.promotion_id, req.quantity)
      if (row) {
        applied.push({
          promotion_id: req.promotion_id,
          quantity: req.quantity,
          units_sold: row.units_sold,
          units_limit: row.units_limit,
        })
        if (row.units_limit !== null && row.units_sold >= row.units_limit) {
          await deactivatePromotion(container, req.promotion_id)
          deactivated.push(req.promotion_id)
        }
      } else {
        rejected.push(req.promotion_id)
        logger.warn(
          `decrement-flash-units: promotion ${req.promotion_id} exhausted; order ${input.order_id} could not consume ${req.quantity} units`
        )
      }
    }

    return new StepResponse(
      { applied, rejected, deactivated },
      { applied, rejected, deactivated }
    )
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.applied?.length) return
    const service: FlashPromotionModuleService = container.resolve(
      FLASH_PROMOTION_MODULE
    )
    for (const a of compensationInput.applied) {
      const flash = (
        await service.listFlashPromotions({ promotion_id: a.promotion_id })
      )[0]
      if (!flash) continue
      const restored = Math.max(0, (flash.units_sold ?? 0) - a.quantity)
      await service.updateFlashPromotions([
        { id: flash.id, units_sold: restored },
      ])
    }
  }
)

async function deactivatePromotion(container: any, promotionId: string): Promise<void> {
  const promotionService = container.resolve(Modules.PROMOTION) as {
    updatePromotions: (data: any) => Promise<any>
  }
  await promotionService.updatePromotions({
    id: promotionId,
    status: PromotionStatus.INACTIVE,
  })
}
