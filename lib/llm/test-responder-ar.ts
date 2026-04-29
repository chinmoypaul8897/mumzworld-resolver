import { runHarness, type PromptUnderTest, type TestInput, type RunResult } from "./harness";
import { RESPONDER_AR_SYSTEM_MESSAGE, responderArUserTemplate } from "../prompts/responder-ar";

/**
 * Run responder AR prompt v1 against gpt-oss-120b on 5 inputs covering
 * the response variation surface in Arabic + dialect mix:
 *
 * AR1 — Gulf casual, panicked formula late, safety-critical
 * AR2 — Formal MSA, damaged car seat, safety-critical, always-escalate
 * AR3 — Levantine, wrong size onesies, standard return
 * AR4 — Mixed code-switched, vague unclear, graceful human handoff
 * AR5 — Egyptian dialect, out-of-scope medical question, polite redirect
 */

const inputs: TestInput[] = [
  {
    id: "AR1",
    description: "AR Gulf — panicked late formula, safety-critical",
    user_message: "yaani the order كان supposed to come yesterday and خلاص my baby has only 2 feeds left, please help",
    context: JSON.stringify(
      {
        order_id: "M44521",
        classification: {
          issue_type: "delivery_delay",
          product_category: "infant_consumables",
          urgency_tier: "safety_critical",
          extracted_facts: {
            product_mentioned: null,
            time_indicator: "yesterday",
            emotional_state: "panicked",
            baby_age_mentioned: null,
          },
          confidence: 0.94,
          language: "mixed",
          language_register: "emotional",
          needs_human: true,
          reasoning: "Late formula, 2 feeds left, panicked tone.",
        },
        policy: {
          primary_entitlement: "alternative_offered",
          secondary_entitlements: ["refund"],
          sla: "same_day",
          always_escalate: false,
          triggers_safety_check: true,
          stop_use_warning: false,
          notes: "Same-day pharmacy alternative + ship fee refund",
        },
        safety: { safety_alert: false, severity: null, reason: null, recommended_action: null, show_pediatrician_disclaimer: false },
      },
      null,
      2
    ),
  },
  {
    id: "AR2",
    description: "AR formal MSA — damaged stroller (CL2 input), safety-critical",
    user_message: "العربة وصلت مع عجلة مكسورة، ما يمديني أستخدمها مع طفلي عمره ٣ شهور",
    context: JSON.stringify(
      {
        order_id: "M44889",
        classification: {
          issue_type: "damaged_item",
          product_category: "infant_safety_critical",
          urgency_tier: "safety_critical",
          extracted_facts: {
            product_mentioned: "العربة",
            time_indicator: null,
            emotional_state: "frustrated",
            baby_age_mentioned: "٣ شهور",
          },
          confidence: 0.95,
          language: "ar",
          language_register: "casual",
          needs_human: true,
          reasoning: "Broken wheel on safety-critical stroller.",
        },
        policy: {
          primary_entitlement: "replacement",
          secondary_entitlements: ["refund"],
          sla: "immediate",
          always_escalate: true,
          triggers_safety_check: true,
          stop_use_warning: true,
          notes: "Damaged safety_critical: replacement, NEVER use damaged item.",
        },
        safety: {
          safety_alert: true,
          severity: "critical",
          reason: "Damaged infant_safety_critical item",
          recommended_action: "Stop-use, replacement, escalate to safety lead within 1hr",
          show_pediatrician_disclaimer: false,
        },
      },
      null,
      2
    ),
  },
  {
    id: "AR3",
    description: "AR Levantine — wrong size onesies, standard",
    user_message: "وصلت الملابس بس مقاسها غلط، طلبت ٦-٩ شهور وبعتولي ٠-٣. بدي بدلها",
    context: JSON.stringify(
      {
        order_id: "M44960",
        classification: {
          issue_type: "wrong_item",
          product_category: "infant_clothing",
          urgency_tier: "standard",
          extracted_facts: {
            product_mentioned: "الملابس",
            time_indicator: null,
            emotional_state: "calm",
            baby_age_mentioned: null,
          },
          confidence: 0.93,
          language: "ar",
          language_register: "casual",
          needs_human: false,
          reasoning: "Wrong size on infant_clothing.",
        },
        policy: {
          primary_entitlement: "replacement",
          secondary_entitlements: ["refund"],
          sla: "48h",
          always_escalate: false,
          triggers_safety_check: false,
          stop_use_warning: false,
          notes: "Wrong item on infant_clothing: replace OR refund within 48h.",
        },
        safety: { safety_alert: false, severity: null, reason: null, recommended_action: null, show_pediatrician_disclaimer: false },
      },
      null,
      2
    ),
  },
  {
    id: "AR4",
    description: "AR mixed — vague unclear, escalate",
    user_message: "في مشكلة بالطلب، مش عارفة شو",
    context: JSON.stringify(
      {
        order_id: "M44712",
        classification: {
          issue_type: "unclear",
          product_category: "unknown",
          urgency_tier: "standard",
          extracted_facts: {
            product_mentioned: null,
            time_indicator: null,
            emotional_state: "frustrated",
            baby_age_mentioned: null,
          },
          confidence: 0.6,
          language: "ar",
          language_register: "casual",
          needs_human: true,
          reasoning: "Vague Arabic message, low confidence.",
        },
        policy: {
          primary_entitlement: "escalate_only",
          secondary_entitlements: [],
          sla: "manual_review",
          always_escalate: true,
          triggers_safety_check: false,
          stop_use_warning: false,
          notes: "Unclear input, route to human.",
        },
        safety: { safety_alert: false, severity: null, reason: null, recommended_action: null, show_pediatrician_disclaimer: false },
      },
      null,
      2
    ),
  },
  {
    id: "AR5",
    description: "AR Egyptian — out-of-scope medical, polite redirect",
    user_message: "هو الحليب ده آمن لطفلي اللي عنده ارتجاع؟",
    context: JSON.stringify(
      {
        order_id: "M44823",
        classification: {
          issue_type: "out_of_scope",
          product_category: "infant_consumables",
          urgency_tier: "standard",
          extracted_facts: {
            product_mentioned: "الحليب",
            time_indicator: null,
            emotional_state: null,
            baby_age_mentioned: null,
          },
          confidence: 0.96,
          language: "ar",
          language_register: "casual",
          needs_human: true,
          reasoning: "Medical question, not an order issue.",
        },
        policy: {
          primary_entitlement: "escalate_only",
          secondary_entitlements: [],
          sla: "manual_review",
          always_escalate: true,
          triggers_safety_check: false,
          stop_use_warning: false,
          notes: "Out-of-scope, redirect to pediatrician + human.",
        },
        safety: {
          safety_alert: false,
          severity: null,
          reason: null,
          recommended_action: null,
          show_pediatrician_disclaimer: true,
        },
      },
      null,
      2
    ),
  },
];

const models = ["openai/gpt-oss-120b:free"];

async function main() {
  const prompt: PromptUnderTest = {
    name: "responder-ar-v1",
    system_message: RESPONDER_AR_SYSTEM_MESSAGE,
    user_template: responderArUserTemplate,
    response_format_json: true,
  };

  const summary = await runHarness(prompt, models, inputs);

  console.log("\n=== RESPONDER AR V1 RUN SUMMARY ===");
  console.log(`Total runs: ${summary.results.length}`);
  console.log(`Parse-OK: ${summary.results.filter((r: RunResult) => r.parse_ok).length}`);
  console.log(`Parse-fail: ${summary.results.filter((r: RunResult) => !r.parse_ok).length}`);
  console.log(`Errors: ${summary.results.filter((r: RunResult) => r.error).length}`);

  for (const model of models) {
    const modelResults = summary.results.filter((r: RunResult) => r.model === model);
    const okCount = modelResults.filter((r: RunResult) => r.parse_ok).length;
    const errCount = modelResults.filter((r: RunResult) => r.error).length;
    const avgLatency =
      modelResults
        .filter((r: RunResult) => r.response)
        .reduce((acc: number, r: RunResult) => acc + (r.response?.latency_ms ?? 0), 0) /
      Math.max(modelResults.filter((r: RunResult) => r.response).length, 1);
    console.log(
      `  ${model}: ${okCount}/${modelResults.length} parse-OK, ${errCount} errors, avg ${Math.round(avgLatency)}ms`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});