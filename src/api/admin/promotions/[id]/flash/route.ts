import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { FLASH_PROMOTION_MODULE } from "../../../../../modules/flash-promotion"
import FlashPromotionModuleService from "../../../../../modules/flash-promotion/service"

type UpsertBody = {
  units_limit?: number | null
  notify_on_activate?: boolean
  notification_segment?: string | null
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service: FlashPromotionModuleService = req.scope.resolve(
    FLASH_PROMOTION_MODULE
  )
  const [flash] = await service.listFlashPromotions({
    promotion_id: req.params.id,
  })
  res.json({ flash: flash ?? null })
}

export async function POST(
  req: MedusaRequest<UpsertBody>,
  res: MedusaResponse
): Promise<void> {
  const promotionId = req.params.id
  const body = req.body ?? ({} as UpsertBody)

  if (
    body.units_limit !== undefined &&
    body.units_limit !== null &&
    (!Number.isInteger(body.units_limit) || body.units_limit < 1)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "units_limit must be a positive integer or null"
    )
  }

  const service: FlashPromotionModuleService = req.scope.resolve(
    FLASH_PROMOTION_MODULE
  )
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const update: Partial<{
    units_limit: number | null
    notify_on_activate: boolean
    notification_segment: string | null
  }> = {}
  if (body.units_limit !== undefined) update.units_limit = body.units_limit
  if (body.notify_on_activate !== undefined)
    update.notify_on_activate = body.notify_on_activate
  if (body.notification_segment !== undefined)
    update.notification_segment = body.notification_segment

  let [flash] = await service.listFlashPromotions({
    promotion_id: promotionId,
  })

  if (!flash) {
    ;[flash] = await service.createFlashPromotions([
      { promotion_id: promotionId, ...update },
    ])
    await link.create({
      [Modules.PROMOTION]: { promotion_id: promotionId },
      [FLASH_PROMOTION_MODULE]: { flash_promotion_id: flash.id },
    })
  } else if (Object.keys(update).length > 0) {
    ;[flash] = await service.updateFlashPromotions([
      { id: flash.id, ...update },
    ])
  }

  res.json({ flash })
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const promotionId = req.params.id

  const service: FlashPromotionModuleService = req.scope.resolve(
    FLASH_PROMOTION_MODULE
  )
  const link = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const [flash] = await service.listFlashPromotions({
    promotion_id: promotionId,
  })
  if (!flash) {
    res.status(204).send()
    return
  }

  await link.dismiss({
    [Modules.PROMOTION]: { promotion_id: promotionId },
    [FLASH_PROMOTION_MODULE]: { flash_promotion_id: flash.id },
  })
  await service.deleteFlashPromotions([flash.id])

  res.status(204).send()
}
