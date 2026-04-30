import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys, PromotionStatus } from "@medusajs/framework/utils"
import { FLASH_PROMOTION_MODULE } from "../../../../modules/flash-promotion"
import type FlashPromotionModuleService from "../../../../modules/flash-promotion/service"

type ActiveFlashPromotion = {
  id: string
  promotion_id: string
  code: string | null
  campaign_name: string | null
  starts_at: string | null
  ends_at: string | null
  time_remaining_seconds: number | null
  units_limit: number | null
  units_sold: number
  units_remaining: number | null
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const flashService: FlashPromotionModuleService = req.scope.resolve(
    FLASH_PROMOTION_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const flashes = await flashService.listFlashPromotions({})
  if (flashes.length === 0) {
    res.json({ flash_promotions: [] })
    return
  }

  const { data: promos } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "code",
      "status",
      "campaign.name",
      "campaign.starts_at",
      "campaign.ends_at",
    ],
    filters: { id: flashes.map((f) => f.promotion_id) },
  })
  const promoById = new Map<string, any>(
    (promos ?? []).map((p: any) => [p.id, p])
  )

  const now = Date.now()
  const result: ActiveFlashPromotion[] = []

  for (const flash of flashes) {
    const promo = promoById.get(flash.promotion_id)
    if (!promo) continue
    if (promo.status !== PromotionStatus.ACTIVE) continue

    const startsAt = promo.campaign?.starts_at ? new Date(promo.campaign.starts_at) : null
    const endsAt = promo.campaign?.ends_at ? new Date(promo.campaign.ends_at) : null

    if (startsAt && startsAt.getTime() > now) continue
    if (endsAt && endsAt.getTime() <= now) continue
    if (
      flash.units_limit !== null &&
      flash.units_sold >= flash.units_limit
    ) {
      continue
    }

    result.push({
      id: flash.id,
      promotion_id: flash.promotion_id,
      code: promo.code ?? null,
      campaign_name: promo.campaign?.name ?? null,
      starts_at: startsAt?.toISOString() ?? null,
      ends_at: endsAt?.toISOString() ?? null,
      time_remaining_seconds: endsAt
        ? Math.max(0, Math.floor((endsAt.getTime() - now) / 1000))
        : null,
      units_limit: flash.units_limit,
      units_sold: flash.units_sold,
      units_remaining:
        flash.units_limit !== null
          ? Math.max(0, flash.units_limit - flash.units_sold)
          : null,
    })
  }

  res.json({ flash_promotions: result })
}
