import { MedusaService } from "@medusajs/framework/utils"
import FlashPromotion from "./models/flash-promotion"

type RawManager = {
  execute: (sql: string, params?: unknown[]) => Promise<any>
}

class FlashPromotionModuleService extends MedusaService({
  FlashPromotion,
}) {
  /**
   * Atomically increment `units_sold` by `quantity` for a flash promotion,
   * but only if `units_limit` is null OR `units_sold + quantity <= units_limit`.
   *
   * Returns the resulting row when the increment was applied, or `null` when the
   * limit would have been exceeded (caller should treat the promo as exhausted).
   *
   * Single SQL UPDATE with a guard so concurrent orders cannot oversell.
   */
  async tryIncrementUnitsSold(
    promotionId: string,
    quantity: number
  ): Promise<{ id: string; units_sold: number; units_limit: number | null } | null> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("tryIncrementUnitsSold: quantity must be a positive integer")
    }

    const manager = this.getRawManager()
    const result = await manager.execute(
      `UPDATE flash_promotion
         SET units_sold = units_sold + ?,
             updated_at = now()
       WHERE promotion_id = ?
         AND deleted_at IS NULL
         AND (units_limit IS NULL OR units_sold + ? <= units_limit)
       RETURNING id, units_sold, units_limit`,
      [quantity, promotionId, quantity]
    )

    const rows: Array<{ id: string; units_sold: number; units_limit: number | null }> =
      Array.isArray(result) ? result : result?.rows ?? []
    return rows[0] ?? null
  }

  async markNotified(promotionId: string, when: Date = new Date()): Promise<void> {
    const manager = this.getRawManager()
    await manager.execute(
      `UPDATE flash_promotion
         SET notified_at = ?, updated_at = now()
       WHERE promotion_id = ? AND deleted_at IS NULL AND notified_at IS NULL`,
      [when, promotionId]
    )
  }

  protected getRawManager(): RawManager {
    const self = this as any
    const candidates = [
      "__flashPromotionRepository__",
      "flashPromotionService_",
      "flashPromotion_",
    ]
    for (const key of candidates) {
      const target = self[key]
      if (target?.getActiveManager) {
        return target.getActiveManager() as RawManager
      }
      if (target?.__container__) {
        const repo = target.__container__["flashPromotionRepository"]
        if (repo?.getActiveManager) {
          return repo.getActiveManager() as RawManager
        }
      }
    }
    const container = self.__container__
    if (container) {
      const repo = container["flashPromotionRepository"]
      if (repo?.getActiveManager) {
        return repo.getActiveManager() as RawManager
      }
      const mgr = container["manager"]
      if (mgr?.execute) return mgr as RawManager
    }
    throw new Error(
      `flash-promotion: cannot resolve EntityManager (keys: ${Object.keys(self).join(",")})`
    )
  }
}

export default FlashPromotionModuleService
