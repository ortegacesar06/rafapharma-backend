import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FLASH_PROMOTION_MODULE } from "../../../modules/flash-promotion"
import type FlashPromotionModuleService from "../../../modules/flash-promotion/service"
import {
  BREVO_CONTACTS_MODULE,
  type BrevoContactsModuleService,
} from "../../../modules/brevo-contacts/service"

export type NotifyFlashActivationInput = {
  promotion_id: string
}

export type NotifyFlashActivationResult = {
  notified: boolean
  recipients: number
}

export const notifyFlashActivationStepId = "notify-flash-activation"

export const notifyFlashActivationStep = createStep(
  notifyFlashActivationStepId,
  async (
    input: NotifyFlashActivationInput,
    { container }
  ): Promise<StepResponse<NotifyFlashActivationResult, null>> => {
    const flashService: FlashPromotionModuleService = container.resolve(
      FLASH_PROMOTION_MODULE
    )
    const logger = container.resolve("logger")
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const [flash] = await flashService.listFlashPromotions({
      promotion_id: input.promotion_id,
    })
    if (!flash || !flash.notify_on_activate || flash.notified_at) {
      return new StepResponse({ notified: false, recipients: 0 }, null)
    }

    const { data: promos } = await query.graph({
      entity: "promotion",
      fields: ["id", "code", "campaign.starts_at", "campaign.ends_at", "campaign.name"],
      filters: { id: input.promotion_id },
    })
    const promo = promos?.[0]
    if (!promo) {
      return new StepResponse({ notified: false, recipients: 0 }, null)
    }

    const recipients = await resolveSegmentRecipients(
      container,
      query,
      flash.notification_segment
    )

    let notification: any
    try {
      notification = container.resolve(Modules.NOTIFICATION)
    } catch {
      logger.warn(
        `notify-flash-activation: notification module not registered; skipping promotion ${input.promotion_id}`
      )
      await flashService.markNotified(input.promotion_id)
      return new StepResponse({ notified: false, recipients: 0 }, null)
    }

    await Promise.all(
      recipients.map((email) =>
        notification
          .createNotifications({
            to: email,
            channel: "email",
            template: "flash-promotion-activated",
            data: {
              promotion_id: promo.id,
              promotion_code: promo.code,
              campaign_name: promo.campaign?.name,
              starts_at: promo.campaign?.starts_at,
              ends_at: promo.campaign?.ends_at,
            },
          })
          .catch((err: Error) =>
            logger.error(
              `notify-flash-activation: send to ${email} failed: ${err.message}`
            )
          )
      )
    )

    await flashService.markNotified(input.promotion_id)
    return new StepResponse({ notified: true, recipients: recipients.length }, null)
  }
)

async function resolveSegmentRecipients(
  container: any,
  query: any,
  segment: string | null
): Promise<string[]> {
  let brevoContacts: BrevoContactsModuleService | undefined
  try {
    brevoContacts = container.resolve(BREVO_CONTACTS_MODULE) as BrevoContactsModuleService
  } catch {
    brevoContacts = undefined
  }

  if (brevoContacts) {
    const listId = brevoContacts.resolveSegmentListId(segment)
    if (listId) {
      return brevoContacts.getListContacts(listId)
    }
  }

  const { data } = await query.graph({
    entity: "customer",
    fields: ["email"],
    filters: segment ? {} : { has_account: true },
  })
  return (data ?? [])
    .map((c: { email?: string }) => c.email)
    .filter((e: unknown): e is string => typeof e === "string" && e.length > 0)
}
