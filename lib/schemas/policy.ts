import { z } from "zod";

/**
 * The kinds of entitlement outcomes the policy can grant.
 * - refund: money back to original payment method
 * - replacement: free re-ship of the same item
 * - store_credit: credit/voucher with optional bonus
 * - alternative_offered: same-day pharmacy/local pickup of equivalent
 * - escalate_only: AI cannot decide; human reviews
 * - honor_original_price: for cancelled-then-restocked items at higher price
 */
export const EntitlementSchema = z.enum([
  "refund",
  "replacement",
  "store_credit",
  "alternative_offered",
  "escalate_only",
  "honor_original_price",
]);

export type Entitlement = z.infer<typeof EntitlementSchema>;

/**
 * SLA tier — how fast we commit to resolving.
 * Drives the "what happens next" timeline shown to mom.
 * - immediate: action taken in the same turn (e.g., refund authorized now)
 * - same_day: resolved within hours
 * - 24h: within one business day
 * - 48h: within two business days
 * - manual_review: no automated SLA, queued for human
 */
export const SlaTierSchema = z.enum([
  "immediate",
  "same_day",
  "24h",
  "48h",
  "manual_review",
]);

export type SlaTier = z.infer<typeof SlaTierSchema>;

/**
 * A single cell of the policy matrix.
 *
 * primary_entitlement is what we offer first. secondary_entitlements
 * is the optional list of alternatives mom can choose ("refund OR
 * replacement"). Empty array means no alternatives.
 *
 * always_escalate: even when the AI is fully confident, route to human
 * (e.g., damaged car seats — never trusted to auto-resolve).
 *
 * triggers_safety_check: this cell engages the separate safety
 * classifier. Bias toward true for any infant_consumables /
 * infant_safety_critical interaction.
 *
 * stop_use_warning: include "do not use this product" language
 * in the response.
 *
 * notes: free-text rationale for humans reading the table later.
 * Not used by the engine; documentation only.
 */
export const PolicyCellSchema = z.object({
  primary_entitlement: EntitlementSchema,
  secondary_entitlements: z.array(EntitlementSchema),
  sla: SlaTierSchema,
  always_escalate: z.boolean(),
  triggers_safety_check: z.boolean(),
  stop_use_warning: z.boolean(),
  notes: z.string().min(1),
});

export type PolicyCell = z.infer<typeof PolicyCellSchema>;