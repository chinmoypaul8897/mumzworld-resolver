import type { SafetySeverity } from "../schemas/safety";

/**
 * Safety rules encoded as data, not code.
 *
 * The safety classifier LLM call receives these rules in its system
 * prompt. Each rule has:
 * - an id for traceability in evals
 * - a category: hard | soft | must_not
 * - an applies_when condition (plain English, the LLM interprets it)
 * - the severity to assign when triggered (or null for must_not rules)
 * - example phrases in EN and AR that should/shouldn't trigger
 *
 * Bias direction (encoded in rule severities):
 * - false positives are cheap (CS rep checks, no harm done)
 * - false negatives are catastrophic (baby health risk)
 * - when in doubt, escalate
 */

export type SafetyRuleCategory = "hard" | "soft" | "must_not";

export interface SafetyRule {
  id: string;
  category: SafetyRuleCategory;
  applies_when: string;
  severity: SafetySeverity | null;  // null for must_not rules
  example_triggers_en: string[];
  example_triggers_ar: string[];
  example_does_not_trigger: string[];
  notes: string;
}

/**
 * HARD RULES — always trigger an alert at the specified severity.
 * The LLM has no judgment here; if the condition matches, alert.
 */
const hardRules: SafetyRule[] = [
  {
    id: "consumable-temperature-or-contamination-critical",
    category: "hard",
    applies_when:
      "Product category is infant_consumables AND mom describes temperature anomaly (warm/hot/spoiled smell), packaging breach (open/torn/leaking), or expired-on-arrival.",
    severity: "critical",
    example_triggers_en: [
      "the formula was warm when it arrived",
      "the milk smelled off",
      "the package was open and the seal was broken",
      "the baby food jar was loose, lid not sealed",
      "expired baby food, expiry date is last month",
    ],
    example_triggers_ar: [
      "الحليب كان دافي لما وصل",
      "ريحة الحليب غريبة",
      "الكرتون كان مفتوح",
      "تاريخ انتهاء طعام الطفل قديم",
    ],
    example_does_not_trigger: [
      "the formula was the wrong brand",
      "the wipes were the wrong size",
      "the diapers came in a slightly dented box but sealed",
    ],
    notes:
      "STOP-USE warning. Same-day replacement. Mandatory escalation within 1hr. Pediatrician disclaimer if mom mentions baby consumed any.",
  },
  {
    id: "safety-item-any-damage-critical",
    category: "hard",
    applies_when:
      "Product category is infant_safety_critical (car seat, crib, stroller, baby gate, monitor) AND mom describes ANY physical damage, defect, or malfunction — including cosmetic.",
    severity: "critical",
    example_triggers_en: [
      "the car seat box has a dent",
      "stroller wheel is wobbly",
      "crib has a crack on the side rail",
      "baby gate doesn't lock properly",
      "monitor screen is scratched but works",
    ],
    example_triggers_ar: [
      "كرسي السيارة فيه كسر صغير",
      "عجلة العربة مهتزة",
      "السرير فيه شق",
    ],
    example_does_not_trigger: [
      "the car seat color isn't what I expected",
      "the stroller bag is missing the manual",
    ],
    notes:
      "STOP-USE warning. Forensic. AI never auto-resolves; always escalate. Replacement + return.",
  },
  {
    id: "baby-consumed-or-used-problematic-item-critical",
    category: "hard",
    applies_when:
      "Mom mentions her baby has already consumed or used the problematic item.",
    severity: "critical",
    example_triggers_en: [
      "baby drank some of the warm formula",
      "I gave the baby food before I noticed it expired",
      "she's been using the car seat since Monday",
      "he's been sleeping in the crib for 3 nights",
    ],
    example_triggers_ar: [
      "الطفل شرب من الحليب الدافي",
      "ابني نام في السرير ثلاث ليالي",
    ],
    example_does_not_trigger: [
      "baby hasn't used it yet, just opened the box",
      "I noticed before giving it to her",
    ],
    notes:
      "Pediatrician referral language mandatory. Immediate human escalation. NEVER diagnose or reassure. Do not say 'baby is fine'.",
  },
  {
    id: "baby-symptoms-after-product-use-critical",
    category: "hard",
    applies_when:
      "Mom describes baby having symptoms (rash, vomiting, fussiness, sleep issues, breathing changes, anything physical) potentially linked to a product.",
    severity: "critical",
    example_triggers_en: [
      "baby has been fussy since drinking that formula",
      "rash where the diaper sits",
      "vomiting after the new milk",
      "she's been crying nonstop since I changed brands",
    ],
    example_triggers_ar: [
      "الطفل صار يبكي بعد ما شرب الحليب الجديد",
      "طفح جلدي مكان الحفاضة",
    ],
    example_does_not_trigger: [
      "baby is doing fine",
      "we tried it once and didn't like the smell",
    ],
    notes:
      "Pediatrician disclaimer. Never diagnose ('this could be allergy'). Never reassure ('it's probably nothing'). Handle the product side; defer health to her pediatrician.",
  },
];

/**
 * SOFT RULES — context-dependent. The LLM uses judgment within
 * the bounds the rule sets.
 */
const softRules: SafetyRule[] = [
  {
    id: "consumable-ambiguous-temperature-warning",
    category: "soft",
    applies_when:
      "Product is infant_consumables AND mom uses softening language about temperature (e.g., 'a bit warm', 'kind of room temp', 'maybe my fridge is cold').",
    severity: "warning",
    example_triggers_en: [
      "the formula was a bit warm",
      "milk seemed maybe room temp, not sure if my fridge is cold enough",
      "felt slightly warm but might be normal",
    ],
    example_triggers_ar: [
      "الحليب كان دافي شوي",
      "ممكن يكون ثلاجتي مو باردة",
    ],
    example_does_not_trigger: [
      "formula was clearly hot",  // covered by hard rule
      "milk was completely fine",
    ],
    notes:
      "Warning level. Log for review. Offer replacement. No mandatory escalation. Don't dismiss her observation but don't overreact either.",
  },
  {
    id: "diaper-rash-or-skin-reaction-warning",
    category: "soft",
    applies_when:
      "Mom mentions diaper rash, skin irritation, or allergic reaction connected to wipes/diapers/skincare. Baby's body is involved but product safety isn't necessarily compromised.",
    severity: "warning",
    example_triggers_en: [
      "this brand of diaper gives my baby a rash",
      "the wipes irritate her skin",
      "redness where the diaper sits",
    ],
    example_triggers_ar: [
      "هذه الحفاضات تسبب طفح",
      "المناديل تهيج بشرتها",
    ],
    example_does_not_trigger: [
      "the diapers leak",
      "wipes don't smell nice",
    ],
    notes:
      "Safety check engages but no STOP-USE on remaining stock (mom switches brand, doesn't trash the box). Offer alternative + refund. Pediatrician disclaimer optional, depends on severity.",
  },
  {
    id: "non-safety-cosmetic-damage-info",
    category: "soft",
    applies_when:
      "Cosmetic damage on a non-safety item (scratch on stroller frame, scuff on toy, faded clothing).",
    severity: "info",
    example_triggers_en: [
      "scratch on the stroller frame",
      "the toy box is dented but the toy is fine",
    ],
    example_triggers_ar: [
      "خدش على هيكل العربة",
    ],
    example_does_not_trigger: [
      "stroller wheel is wobbly",  // hard rule territory
    ],
    notes: "Info-level only. Standard return path. No escalation.",
  },
  {
    id: "vague-emotional-complaint-info",
    category: "soft",
    applies_when:
      "Mom expresses strong frustration or panic without a specific safety signal. The emotional weight alone doesn't trigger safety, but routes to human.",
    severity: "info",
    example_triggers_en: [
      "I'M SO ANGRY this is the third time",
      "please please help, I don't know what to do",
    ],
    example_triggers_ar: [
      "صار لي مرتين هالشي، عجل ساعدوني",
    ],
    example_does_not_trigger: [
      "the wrong color came",  // calm wording
    ],
    notes: "Route to human despite no concrete safety issue. Frustration alone is its own signal.",
  },
];

/**
 * MUST-NOT RULES — behaviors the safety classifier (and downstream
 * responder) must never exhibit. These are negative constraints.
 */
const mustNotRules: SafetyRule[] = [
  {
    id: "must-not-diagnose-medical-condition",
    category: "must_not",
    applies_when:
      "Any safety alert involving baby's body, symptoms, or health.",
    severity: null,
    example_triggers_en: [
      "this sounds like a milk allergy",
      "your baby probably has reflux",
      "this rash looks like eczema",
    ],
    example_triggers_ar: [],
    example_does_not_trigger: [
      "we recommend contacting your pediatrician",
      "for symptoms, please reach out to your doctor",
    ],
    notes:
      "Never name a condition, never speculate on a diagnosis. Always defer to pediatrician.",
  },
  {
    id: "must-not-reassure-or-dismiss",
    category: "must_not",
    applies_when:
      "Mom expresses concern about her baby's safety or wellbeing.",
    severity: null,
    example_triggers_en: [
      "your baby is probably fine",
      "this is nothing to worry about",
      "warm formula isn't a big deal",
    ],
    example_triggers_ar: [
      "ما عليك، هذا شي عادي",
    ],
    example_does_not_trigger: [
      "if you're concerned, please contact your pediatrician",
    ],
    notes:
      "Never reassure. Even if statistically the baby is fine, mom's instinct is the signal. Trust it. Handle the product side; defer the health side.",
  },
  {
    id: "must-not-dosage-or-medical-advice",
    category: "must_not",
    applies_when:
      "Conversation touches on dosage, medication, or therapeutic use of any kind.",
    severity: null,
    example_triggers_en: [
      "give baby half a teaspoon of...",
      "you can use Tylenol for...",
    ],
    example_triggers_ar: [],
    example_does_not_trigger: [
      "we cannot advise on dosage; please ask your pediatrician",
    ],
    notes:
      "Never. Mumzworld is not a medical provider. Refuse and redirect.",
  },
  {
    id: "must-not-override-mom-instinct",
    category: "must_not",
    applies_when:
      "Mom expresses worry or concern about her baby, even if details seem minor.",
    severity: null,
    example_triggers_en: [
      "I'm sure he's fine, you don't need to worry",
      "this is too small a thing to escalate",
    ],
    example_triggers_ar: [],
    example_does_not_trigger: [
      "if your instinct says something's off, please call your pediatrician",
    ],
    notes:
      "If mom is worried, the AI is worried. Period.",
  },
];

/**
 * Public export — flat list of all rules, with the category preserved
 * so the prompt can group them when building the system message.
 */
export const safetyRules: SafetyRule[] = [
  ...hardRules,
  ...softRules,
  ...mustNotRules,
];

/**
 * Helper: get only the hard rules (used by evals to spot-check
 * critical-tier classification).
 */
export function getHardRules(): SafetyRule[] {
  return safetyRules.filter((r) => r.category === "hard");
}

/**
 * Helper: get only the must-not rules (used in prompts and evals
 * to verify the responder doesn't violate negative constraints).
 */
export function getMustNotRules(): SafetyRule[] {
  return safetyRules.filter((r) => r.category === "must_not");
}