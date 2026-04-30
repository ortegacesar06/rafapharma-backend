import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { FLASH_PROMOTION_MODULE } from "../index"
import FlashPromotionModuleService from "../service"

jest.setTimeout(60_000)

moduleIntegrationTestRunner<FlashPromotionModuleService>({
  moduleName: FLASH_PROMOTION_MODULE,
  resolve: __dirname + "/..",
  testSuite: ({ service }) => {
    describe("FlashPromotionModuleService", () => {
      it("creates a flash promotion with defaults", async () => {
        const [flash] = await service.createFlashPromotions([
          { promotion_id: "promo_create_defaults" },
        ])
        expect(flash.units_sold).toBe(0)
        expect(flash.notify_on_activate).toBe(false)
        expect(flash.units_limit).toBeNull()
        expect(flash.notified_at).toBeNull()
      })

      it("enforces unique promotion_id", async () => {
        await service.createFlashPromotions([{ promotion_id: "promo_unique" }])
        await expect(
          service.createFlashPromotions([{ promotion_id: "promo_unique" }])
        ).rejects.toThrow()
      })

      describe("tryIncrementUnitsSold", () => {
        it("increments when below the limit", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_inc_1", units_limit: 10 },
          ])
          const r = await service.tryIncrementUnitsSold("promo_inc_1", 3)
          expect(r).not.toBeNull()
          expect(r!.units_sold).toBe(3)
          expect(r!.units_limit).toBe(10)
        })

        it("returns null when the increment would exceed the limit", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_inc_2", units_limit: 5, units_sold: 4 },
          ])
          const r = await service.tryIncrementUnitsSold("promo_inc_2", 2)
          expect(r).toBeNull()

          const [flash] = await service.listFlashPromotions({
            promotion_id: "promo_inc_2",
          })
          expect(flash.units_sold).toBe(4)
        })

        it("allows the increment that hits exactly the limit", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_inc_3", units_limit: 5, units_sold: 4 },
          ])
          const r = await service.tryIncrementUnitsSold("promo_inc_3", 1)
          expect(r).not.toBeNull()
          expect(r!.units_sold).toBe(5)
        })

        it("increments unbounded when units_limit is null", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_inc_4", units_limit: null },
          ])
          const r = await service.tryIncrementUnitsSold("promo_inc_4", 999)
          expect(r).not.toBeNull()
          expect(r!.units_sold).toBe(999)
          expect(r!.units_limit).toBeNull()
        })

        it("rejects non-positive quantities", async () => {
          await service.createFlashPromotions([{ promotion_id: "promo_inc_5" }])
          await expect(
            service.tryIncrementUnitsSold("promo_inc_5", 0)
          ).rejects.toThrow(/positive integer/)
        })

        it("is atomic under concurrent increments at the limit", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_concurrent", units_limit: 10 },
          ])
          const promises = Array.from({ length: 20 }, () =>
            service.tryIncrementUnitsSold("promo_concurrent", 1)
          )
          const outcomes = await Promise.all(promises)
          const accepted = outcomes.filter((o) => o !== null)
          const rejected = outcomes.filter((o) => o === null)
          expect(accepted).toHaveLength(10)
          expect(rejected).toHaveLength(10)

          const [flash] = await service.listFlashPromotions({
            promotion_id: "promo_concurrent",
          })
          expect(flash.units_sold).toBe(10)
        })
      })

      describe("markNotified", () => {
        it("sets notified_at exactly once", async () => {
          await service.createFlashPromotions([
            { promotion_id: "promo_notify", notify_on_activate: true },
          ])
          await service.markNotified("promo_notify")
          const [first] = await service.listFlashPromotions({
            promotion_id: "promo_notify",
          })
          expect(first.notified_at).not.toBeNull()
          const firstStamp = first.notified_at

          await service.markNotified("promo_notify")
          const [second] = await service.listFlashPromotions({
            promotion_id: "promo_notify",
          })
          expect(second.notified_at).toEqual(firstStamp)
        })
      })
    })
  },
})
