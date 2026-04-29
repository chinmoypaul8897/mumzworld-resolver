import { z } from "zod";

/**
 * The 6 issue types that the policy table can resolve,
 * plus two escape hatches:
 * - out_of_scope: not a returns/order issue at all
 *   (e.g., medical question, parenting advice)
 * - unclear: too ambiguous to classify confidently
 */
export const IssueTypeSchema = z.enum([
  "delivery_delay",
  "wrong_item",
  "damaged_item",
  "quality_concern",
  "cancellation_dispute",
  "registry_refund_dispute",
  "out_of_scope",
  "unclear",
]);

export type IssueType = z.infer<typeof IssueTypeSchema>;

/**
 * Same 6 product categories as in order.ts, plus "unknown"
 * for cases where the message doesn't mention a product
 * or the product can't be inferred from order context.
 */
export const ClassifierProductCategorySchema = z.enum([
  "infant_consumables",
  "infant_safety_critical",
  "infant_clothing",
  "infant_gear_general",
  "mom_essentials",
  "gift_or_registry",
  "unknown",
]);

export type ClassifierProductCategory = z.infer<typeof ClassifierProductCategorySchema>;

/**
 * Three urgency tiers driving response speed and human routing.
 * - safety_critical: infant consumables/safety items in distress.
 *   Bypass standard flow. Same-day. Escalate to human within 1hr.
 * - time_sensitive: late delivery of consumables, urgent gift,
 *   anything where >1 day delay materially harms mom.
 * - standard: normal return/refund window applies.
 */
export const UrgencyTierSchema = z.enum([
  "safety_critical",
  "time_sensitive",
  "standard",
]);

export type UrgencyTier = z.infer<typeof UrgencyTierSchema>;

/**
 * Mom's detected emotional state from the message.
 * Used by the response generator to match register and pace.
 * Null when the message is too brief or neutral to tell.
 */
export const EmotionalStateSchema = z.enum([
  "calm",
  "frustrated",
  "panicked",
  "angry",
]);

export type EmotionalState = z.infer<typeof EmotionalStateSchema>;

/**
 * Structured facts extracted from mom's free text.
 * Each field is nullable: the AI must return null rather than
 * inventing facts not present in the message.
 */
export const ExtractedFactsSchema = z.object({
  product_mentioned: z.string().nullable(),     // e.g., "formula", "stroller", or null
  time_indicator: z.string().nullable(),         // e.g., "yesterday", "3 days late", or null
  emotional_state: EmotionalStateSchema.nullable(),
  baby_age_mentioned: z.string().nullable(),     // e.g., "6 weeks old", "newborn"
});

export type ExtractedFacts = z.infer<typeof ExtractedFactsSchema>;

/**
 * Detected language of mom's message.
 * - "mixed" means real code-switching (English + Arabic in same message),
 *   not a stray loan word.
 */
export const LanguageSchema = z.enum(["en", "ar", "mixed"]);

export type Language = z.infer<typeof LanguageSchema>;

/**
 * Register helps the response generator match how mom writes.
 * - formal: full sentences, careful grammar, MSA-style
 * - casual: shortened, dialectal, everyday
 * - emotional: panicked, agitated, urgent
 */
export const LanguageRegisterSchema = z.enum([
  "formal",
  "casual",
  "emotional",
]);

export type LanguageRegister = z.infer<typeof LanguageRegisterSchema>;

/**
 * The full classification result. This is what the classifier LLM
 * MUST return as valid JSON. Anything else (malformed, missing fields,
 * invalid enum values) gets caught by Zod validation and triggers a retry.
 *
 * The orchestrator uses (issue_type, product_category) to look up the
 * policy table, urgency_tier to set SLA + safety routing, language to
 * pick the response prompt (EN or AR), and needs_human + confidence
 * to decide whether to escalate.
 */
export const ClassificationSchema = z.object({
  issue_type: IssueTypeSchema,
  product_category: ClassifierProductCategorySchema,
  urgency_tier: UrgencyTierSchema,
  extracted_facts: ExtractedFactsSchema,
  confidence: z.number().min(0).max(1),
  language: LanguageSchema,
  language_register: LanguageRegisterSchema.nullable(),
  needs_human: z.boolean(),
  reasoning: z.string().min(1),  // never empty — even one word is OK
});

export type Classification = z.infer<typeof ClassificationSchema>;