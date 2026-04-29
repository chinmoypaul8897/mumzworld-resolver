import { z } from "zod";

/**
 * Severity levels for safety alerts.
 * - info: cosmetic or low-stakes signal worth logging, no action change
 *   (e.g., diaper rash mention without product damage)
 * - warning: ambiguous safety signal, conservative routing
 *   (e.g., "the formula seemed a bit warm")
 * - critical: clear safety issue requiring stop-use + immediate human
 *   (e.g., "formula was hot, baby drank some")
 */
export const SafetySeveritySchema = z.enum([
  "info",
  "warning",
  "critical",
]);

export type SafetySeverity = z.infer<typeof SafetySeveritySchema>;

/**
 * The safety classifier's output. Narrow scope by design:
 * one binary decision (alert or not) plus the why.
 *
 * Bias rules (enforced by the prompt, not the schema):
 * - false positives are cheap, false negatives are catastrophic
 * - never diagnose, never reassure ("baby is fine"), never give dosage advice
 * - if mom's instinct is concerned, trust it
 *
 * When safety_alert is false, severity / reason / recommended_action
 * are null. When safety_alert is true, all three must be present.
 */
export const SafetyResultSchema = z.object({
  safety_alert: z.boolean(),
  severity: SafetySeveritySchema.nullable(),
  reason: z.string().nullable(),
  recommended_action: z.string().nullable(),
  show_pediatrician_disclaimer: z.boolean(),
}).refine(
  // If safety_alert is true, severity/reason/action must all be non-null.
  // If false, they should all be null. Enforce both directions.
  (data) => {
    if (data.safety_alert) {
      return data.severity !== null
          && data.reason !== null
          && data.recommended_action !== null;
    }
    return data.severity === null
        && data.reason === null
        && data.recommended_action === null;
  },
  {
    message:
      "If safety_alert is true, severity/reason/recommended_action must all be present. " +
      "If safety_alert is false, all three must be null.",
  }
);

export type SafetyResult = z.infer<typeof SafetyResultSchema>;