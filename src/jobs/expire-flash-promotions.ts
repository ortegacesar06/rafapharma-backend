import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  PromotionStatus,
} from "@medusajs/framework/utils"
import { FLASH_PROMOTION_MODULE } from "../modules/flash-promotion"
import type FlashPromotionModuleService from "../modules/flash-promotion/service"
import { activateFlashPromotionWorkflow } from "../workflows/flash-promotion"

/**
 * Cron cada minuto:
 *  1. Para flash promos cuya campaña ya inició y `notify_on_activate=true`
 *     pero `notified_at` está vacío → dispara `activate-flash-promotion`.
 *  2. Para flash promos cuya campaña ya expiró → marca la promo nativa como
 *     `inactive` (idempotente).
 */
export default async function expireFlashPromotionsHandler(
  container: MedusaContainer
): Promise<void> {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const flashService: FlashPromotionModuleService = container.resolve(
    FLASH_PROMOTION_MODULE
  )
  const promotionService = container.resolve(Modules.PROMOTION) as {
    updatePromotions: (data: any) => Promise<any>
  }

  const flashes = await flashService.listFlashPromotions({})
  if (flashes.length === 0) return

  const now = new Date()

  const { data: promos } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "status",
      "campaign.starts_at",
      "campaign.ends_at",
    ],
    filters: { id: flashes.map((f) => f.promotion_id) },
  })
  const promoById = new Map<string, any>(
    (promos ?? []).map((p: any) => [p.id, p])
  )

  for (const flash of flashes) {
    const promo = promoById.get(flash.promotion_id)
    if (!promo) continue

    const startsAt = promo.campaign?.starts_at
      ? new Date(promo.campaign.starts_at)
      : null
    const endsAt = promo.campaign?.ends_at
      ? new Date(promo.campaign.ends_at)
      : null

    if (
      flash.notify_on_activate &&
      !flash.notified_at &&
      startsAt &&
      startsAt <= now &&
      (!endsAt || endsAt > now)
    ) {
      try {
        await activateFlashPromotionWorkflow(container).run({
          input: { promotion_id: flash.promotion_id },
        })
      } catch (err) {
        logger.error(
          `expire-flash-promotions: activation failed for ${flash.promotion_id}: ${(err as Error).message}`
        )
      }
    }

    if (endsAt && endsAt <= now && promo.status !== PromotionStatus.INACTIVE) {
      try {
        await promotionService.updatePromotions({
          id: flash.promotion_id,
          status: PromotionStatus.INACTIVE,
        })
      } catch (err) {
        logger.error(
          `expire-flash-promotions: deactivation failed for ${flash.promotion_id}: ${(err as Error).message}`
        )
      }
    }
  }
}

export const config = {
  name: "expire-flash-promotions",
  schedule: "* * * * *",
}
