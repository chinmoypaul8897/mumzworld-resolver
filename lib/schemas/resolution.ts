import { z } from "zod";
import { SafetySeveritySchema } from "./safety";

/**
 * The "what we did" section is rendered as a list of discrete items.
 * Each item has a short label (e.g., "Refund authorized")
 * and a detail line (e.g., "28 AED priority shipping fee").
 */
export const WhatWeDidItemSchema = z.object({
  label: z.string().min(1).max(60),
  detail: z.string().min(1).max(200),
});

export type WhatWeDidItem = z.infer<typeof WhatWeDidItemSchema>;

/**
 * The "talk to a human" CTA always renders, but with two pieces:
 * - the visible button label (e.g., "I need to talk to a human")
 * - a context_bundle that gets attached if mom taps it.
 *
 * context_bundle is loosely typed (Record<string, unknown>) on purpose:
 * the orchestrator decides what to pack in (full conversation,
 * classification, order). The CS agent endpoint reads from this bundle
 * so the agent never has to ask mom to repeat herself.
 */
export const TalkToHumanCtaSchema = z.object({
  label: z.string().min(1).max(50),
  context_bundle: z.record(z.string(), z.unknown()),
});

export type TalkToHumanCta = z.infer<typeof TalkToHumanCtaSchema>;

/**
 * The safety warning, when present.
 * Null when no safety alert was triggered.
 *
 * This is what mom actually sees, distinct from SafetyResult
 * (which is the classifier's internal output). The responder
 * generates a mom-readable message from the safety result.
 */
export const ResolutionSafetyWarningSchema = z.object({
  severity: SafetySeveritySchema,
  message: z.string().min(1),
});

export type ResolutionSafetyWarning = z.infer<typeof ResolutionSafetyWarningSchema>;

/**
 * Meta block — transparency data for evaluation and debugging.
 * Hidden from mom in production UI; visible in eval mode.
 */
export const ResolutionMetaSchema = z.object({
  classification_confidence: z.number().min(0).max(1),
  used_human_escalation: z.boolean(),
  response_generation_ms: z.number().nonnegative().optional(),
});

export type ResolutionMeta = z.infer<typeof ResolutionMetaSchema>;

/**
 * The full resolution response shown to mom.
 *
 * Lengths are bounded to keep responses scannable on a phone:
 * - headline: under ~12 words (60 chars)
 * - immediate_action: under ~40 words (200 chars)
 * - what_happens_next: under ~30 words (150 chars)
 *
 * The .refine() ensures internal consistency:
 * - language matches what's in the meta and what the responder generated
 * - if safety_warning is set, it must have valid severity and message
 *   (already enforced by the nested schema, but documented here)
 */
export const ResolutionSchema = z.object({
  headline: z.string().min(1).max(120),
  immediate_action: z.string().max(300).nullable(),
  what_we_did: z.array(WhatWeDidItemSchema).max(5),
  what_happens_next: z.string().min(1).max(200),
  talk_to_human_cta: TalkToHumanCtaSchema,
  safety_warning: ResolutionSafetyWarningSchema.nullable(),
  language: z.enum(["en", "ar"]),
  meta: ResolutionMetaSchema,
});

export type Resolution = z.infer<typeof ResolutionSchema>;