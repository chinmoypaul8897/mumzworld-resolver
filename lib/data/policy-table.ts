import type { PolicyCell } from "../schemas/policy";
import type { IssueType, ClassifierProductCategory } from "../schemas/classification";

/**
 * THE POLICY TABLE.
 *
 * 6 issue types × 6 product categories = 36 cells.
 * Plus 2 issue-type escape hatches (out_of_scope, unclear) handled
 * by the orchestrator, not this table.
 *
 * Lookup: policyTable[issue_type][product_category]
 *
 * Posture rules baked in:
 * - infant_consumables and infant_safety_critical bias hard toward
 *   safety_check + always_escalate. False positives are cheap.
 * - registry_refund_dispute always escalates. Too many edge cases.
 * - cancellation_dispute honors original price + 10% credit fallback
 *   for the cancelled-then-restocked-at-higher-price trap.
 *
 * To modify: edit a cell. The engine reads from this object directly.
 * No code changes needed for policy adjustments.
 */

type ResolvableProductCategory = Exclude<ClassifierProductCategory, "unknown">;
type ResolvableIssueType = Exclude<IssueType, "out_of_scope" | "unclear">;

type PolicyTable = Record<
  ResolvableIssueType,
  Record<ResolvableProductCategory, PolicyCell>
>;

export const policyTable: PolicyTable = {
  /* ─────────────────────────────────────────────────────────────
   * DELIVERY DELAY
   * Posture: refund the priority shipping fee always; severity
   * scales with category (safety on consumables, gift on registry).
   * ───────────────────────────────────────────────────────────── */
  delivery_delay: {
    // Late formula/diapers — same-day pharmacy alternative is critical.
    // Triggers safety check because <24h consumable supply is a baby-care risk.
    infant_consumables: {
      primary_entitlement: "alternative_offered",
      secondary_entitlements: ["refund"],
      sla: "same_day",
      always_escalate: false,
      triggers_safety_check: true,
      stop_use_warning: false,
      notes: "Late infant consumable: pharmacy alternative + ship fee refund. Safety flag if <24h supply.",
    },
    // Late car seat / crib — refund priority shipping, same-day SLA.
    // Always escalate because safety items deserve a human eye.
    infant_safety_critical: {
      primary_entitlement: "refund",
      secondary_entitlements: [],
      sla: "same_day",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Late safety item: refund priority shipping. Human verifies actual delivery before close.",
    },
    infant_clothing: {
      primary_entitlement: "refund",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Late clothing: refund priority shipping fee.",
    },
    infant_gear_general: {
      primary_entitlement: "refund",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Late gear: refund priority shipping fee.",
    },
    mom_essentials: {
      primary_entitlement: "refund",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Late mom essentials: refund priority shipping fee.",
    },
    // Gift or registry: timeline matters because the event has a date.
    // Same-day SLA, optional gifter apology message.
    gift_or_registry: {
      primary_entitlement: "refund",
      secondary_entitlements: ["store_credit"],
      sla: "same_day",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Late gift/registry: refund + apology to gifter or recipient if shower already passed.",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * WRONG ITEM
   * Posture: free replacement, expedited. Mom keeps wrong item for
   * consumables (no point shipping back formula). Returns wrong item
   * for safety/gear/clothing.
   * ───────────────────────────────────────────────────────────── */
  wrong_item: {
    // Wrong formula type can be a safety issue (allergy, age stage).
    // Mom keeps the wrong tin (no return), gets correct one same-day.
    infant_consumables: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "same_day",
      always_escalate: false,
      triggers_safety_check: true,
      stop_use_warning: false,
      notes: "Wrong consumable: same-day replacement. Mom keeps wrong item. Safety check for formula type/stage.",
    },
    // Wrong car seat = installation/fit risk. Always escalate.
    infant_safety_critical: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "same_day",
      always_escalate: true,
      triggers_safety_check: true,
      stop_use_warning: true,
      notes: "Wrong safety item: stop using wrong one immediately. Same-day replacement. Always escalate.",
    },
    infant_clothing: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Wrong clothing: replacement OR refund, mom's choice. Return wrong item via free pickup.",
    },
    infant_gear_general: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Wrong gear: replacement OR refund. Return wrong item.",
    },
    mom_essentials: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Wrong mom essential: replacement OR refund.",
    },
    gift_or_registry: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Wrong gift item: replacement + apology message option for gifter.",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * DAMAGED ITEM
   * Posture: refund + replacement for safety-implicated items.
   * Stop-use warning whenever damage could affect function/safety.
   * ───────────────────────────────────────────────────────────── */
  damaged_item: {
    // Damaged consumable packaging = potential contamination.
    // Refund + replacement, do not use the damaged batch.
    infant_consumables: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "same_day",
      always_escalate: false,
      triggers_safety_check: true,
      stop_use_warning: true,
      notes: "Damaged consumable packaging = contamination risk. Stop use, replace same-day.",
    },
    // Damaged car seat / crib / stroller = NEVER USE. Forensic.
    // AI does not auto-resolve. Always escalate.
    infant_safety_critical: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "immediate",
      always_escalate: true,
      triggers_safety_check: true,
      stop_use_warning: true,
      notes: "Damaged safety item is forensic. NEVER use. Human-only. Replacement + free return.",
    },
    infant_clothing: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Damaged clothing: replacement OR refund.",
    },
    infant_gear_general: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Damaged gear: replacement OR refund. Stop-use only if functional damage on feeding/bath items.",
    },
    mom_essentials: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Damaged mom essential: replacement OR refund.",
    },
    gift_or_registry: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Damaged gift: replacement + apology to gifter and recipient.",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * QUALITY CONCERN
   * Posture: this is the most safety-loaded row. Quality issues on
   * consumables and safety items are presumed safety-critical until
   * proven otherwise.
   * ───────────────────────────────────────────────────────────── */
  quality_concern: {
    // Formula warm/spoiled, food expired, package open before delivery.
    // The example cell from earlier — strictest posture in the table.
    infant_consumables: {
      primary_entitlement: "replacement",
      secondary_entitlements: ["refund"],
      sla: "same_day",
      always_escalate: true,
      triggers_safety_check: true,
      stop_use_warning: true,
      notes: "Critical safety cell. Stop use, same-day replacement, mandatory escalation, pediatrician disclaimer.",
    },
    // Quality concern on car seat = stop-use, forensic, always human.
    infant_safety_critical: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "immediate",
      always_escalate: true,
      triggers_safety_check: true,
      stop_use_warning: true,
      notes: "Quality concern on safety item. Forensic. Stop use. Human-only.",
    },
    infant_clothing: {
      primary_entitlement: "refund",
      secondary_entitlements: ["replacement"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Quality concern on clothing (e.g., shrinkage, dye bleed): refund.",
    },
    // Diaper rash falls here. Safety check engages (skin reaction)
    // but no stop-use — mom switches brand, not throws out the box.
    infant_gear_general: {
      primary_entitlement: "refund",
      secondary_entitlements: ["alternative_offered"],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: true,
      stop_use_warning: false,
      notes: "Includes diaper rash / wipe irritation. Safety check engages, no stop-use. Offer alternative brand.",
    },
    mom_essentials: {
      primary_entitlement: "refund",
      secondary_entitlements: [],
      sla: "48h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Quality concern on mom essential: refund.",
    },
    gift_or_registry: {
      primary_entitlement: "refund",
      secondary_entitlements: ["replacement"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Quality concern on gift: refund + apology to gifter.",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * CANCELLATION DISPUTE
   * Posture: mumzworld cancelled the order, mom disputes. Default to
   * honoring original price; fallback to store credit + 10% goodwill.
   * Real Trustpilot pattern: mom orders, gets cancelled, voucher issued,
   * item restocks at 2x — mom never gets the original price back.
   * ───────────────────────────────────────────────────────────── */
  cancellation_dispute: {
    infant_consumables: {
      primary_entitlement: "honor_original_price",
      secondary_entitlements: ["store_credit"],
      sla: "same_day",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled consumable order: honor original price + ship priority. Time-sensitive.",
    },
    infant_safety_critical: {
      primary_entitlement: "honor_original_price",
      secondary_entitlements: ["store_credit"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled safety item: honor original price + priority ship.",
    },
    infant_clothing: {
      primary_entitlement: "honor_original_price",
      secondary_entitlements: ["store_credit"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled clothing: honor original price OR store credit + 10% goodwill.",
    },
    infant_gear_general: {
      primary_entitlement: "honor_original_price",
      secondary_entitlements: ["store_credit"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled gear: honor original price OR store credit + 10% goodwill.",
    },
    mom_essentials: {
      primary_entitlement: "honor_original_price",
      secondary_entitlements: ["store_credit"],
      sla: "24h",
      always_escalate: false,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled mom essential: honor original price OR store credit.",
    },
    // Gift cancellation is sensitive — gifter saw a confirmation,
    // recipient may have expected it. Always escalate for human review.
    gift_or_registry: {
      primary_entitlement: "refund",
      secondary_entitlements: ["replacement"],
      sla: "manual_review",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Cancelled gift: refund + manual review of gifter/recipient communication.",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * REGISTRY / REFUND DISPUTE
   * Posture: registry has too many edge cases (duplicate gifts,
   * gifter cancellations, recipient confusion). AI never auto-resolves.
   * Entire row is escalate_only.
   * ───────────────────────────────────────────────────────────── */
  registry_refund_dispute: {
    infant_consumables: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Registry/refund dispute on consumable: human-only. Often duplicate gift or gifter cancellation.",
    },
    infant_safety_critical: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Registry/refund dispute on safety item: human-only.",
    },
    infant_clothing: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "48h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Registry/refund dispute on clothing: human-only.",
    },
    infant_gear_general: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "48h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Registry/refund dispute on gear: human-only.",
    },
    mom_essentials: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "48h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Registry/refund dispute on mom essential: human-only.",
    },
    gift_or_registry: {
      primary_entitlement: "escalate_only",
      secondary_entitlements: [],
      sla: "24h",
      always_escalate: true,
      triggers_safety_check: false,
      stop_use_warning: false,
      notes: "Core registry case. Always escalate to registry team specifically.",
    },
  },
} as const satisfies PolicyTable;

/**
 * Lookup helper — keeps the engine code readable.
 * Returns the cell or null if either key is invalid (out_of_scope,
 * unclear, or unknown). Null means: don't trust the policy table here,
 * route to human.
 */
export function lookupPolicy(
  issue: IssueType,
  category: ClassifierProductCategory
): PolicyCell | null {
  if (issue === "out_of_scope" || issue === "unclear") return null;
  if (category === "unknown") return null;
  return policyTable[issue][category];
}