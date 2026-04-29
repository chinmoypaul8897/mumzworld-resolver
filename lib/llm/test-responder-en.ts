import { runHarness, type PromptUnderTest, type TestInput, type RunResult } from "./harness";
import { RESPONDER_EN_SYSTEM_MESSAGE, responderEnUserTemplate } from "../prompts/responder-en";

/**
 * Run responder EN prompt v1 against gpt-oss-120b on 5 inputs covering
 * the response variation surface:
 *
 * R1 — clean delivery delay, alternative offered (CL1 mom + real classifier output)
 * R2 — damaged car seat, safety-critical, always-escalate (synth)
 * R3 — vague unclear, graceful human handoff (CL4 mom + real classifier output)
 * R4 — out-of-scope medical, polite redirect (CL5 mom + real classifier output)
 * R5 — wrong item, infant_clothing, standard return path (synth)
 *
 * Each test bundles classification + policy cell + safety result into context
 * as a JSON string. The prompt's user template unpacks it.
 */

const inputs: TestInput[] = [
  {
    id: "R1",
    description: "EN — clean delivery delay, pharmacy alt offered (from CL1)",
    user_message:
      "My priority order was supposed to come yesterday and I still haven't received it. I need diapers.",
    context: JSON.stringify(
      {
        order_id: "M44781",
        classification: {
          issue_type: "delivery_delay",
          product_category: "infant_consumables",
          urgency_tier: "time_sensitive",
          extracted_facts: {
            product_mentioned: "diapers",
            time_indicator: "yesterday",
            emotional_state: "frustrated",
            baby_age_mentioned: null,
          },
          confidence: 0.94,
          language: "en",
          language_register: "casual",
          needs_human: false,
          reasoning: "Priority diapers late, time_sensitive urgency.",
        },
        policy: {
          primary_entitlement: "alternative_offered",
          secondary_entitlements: ["refund"],
          sla: "same_day",
          always_escalate: false,
          triggers_safety_check: false,
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
    id: "R2",
    description: "EN — damaged car seat, safety-critical, always-escalate",
    user_message:
      "Just got my car seat delivered today and the plastic shell on the side has a hairline crack. We're supposed to drive to the airport tomorrow.",
    context: JSON.stringify(
      {
        order_id: "M44698",
        classification: {
          issue_type: "damaged_item",
          product_category: "infant_safety_critical",
          urgency_tier: "safety_critical",
          extracted_facts: {
            product_mentioned: "car seat",
            time_indicator: "today",
            emotional_state: "frustrated",
            baby_age_mentioned: null,
          },
          confidence: 0.96,
          language: "en",
          language_register: "casual",
          needs_human: true,
          reasoning: "Cracked shell on infant safety-critical item.",
        },
        policy: {
          primary_entitlement: "replacement",
          secondary_entitlements: ["refund"],
          sla: "immediate",
          always_escalate: true,
          triggers_safety_check: true,
          stop_use_warning: true,
          notes: "Damaged safety_critical: replacement, NEVER use damaged seat. Always escalate.",
        },
        safety: {
          safety_alert: true,
          severity: "critical",
          reason: "Damaged infant_safety_critical item",
          recommended_action: "Stop-use, expedited replacement, escalate to safety lead within 1 hour",
          show_pediatrician_disclaimer: false,
        },
      },
      null,
      2
    ),
  },
  {
    id: "R3",
    description: "EN — vague unclear, graceful human handoff (from CL4)",
    user_message: "the thing isn't right, idk",
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
          confidence: 0.62,
          language: "en",
          language_register: "casual",
          needs_human: true,
          reasoning: "Vague message, low confidence.",
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
    id: "R4",
    description: "EN — out-of-scope medical, polite redirect (from CL5)",
    user_message: "Is this formula safe for my baby with reflux?",
    context: JSON.stringify(
      {
        order_id: "M44823",
        classification: {
          issue_type: "out_of_scope",
          product_category: "infant_consumables",
          urgency_tier: "standard",
          extracted_facts: {
            product_mentioned: "formula",
            time_indicator: null,
            emotional_state: null,
            baby_age_mentioned: null,
          },
          confidence: 0.96,
          language: "en",
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
  {
    id: "R5",
    description: "EN — wrong item, infant_clothing, standard return",
    user_message:
      "Got the onesies today but it's the wrong size — ordered 6-9m and these are 0-3m. Can I exchange?",
    context: JSON.stringify(
      {
        order_id: "M44960",
        classification: {
          issue_type: "wrong_item",
          product_category: "infant_clothing",
          urgency_tier: "standard",
          extracted_facts: {
            product_mentioned: "onesies",
            time_indicator: "today",
            emotional_state: "calm",
            baby_age_mentioned: null,
          },
          confidence: 0.93,
          language: "en",
          language_register: "casual",
          needs_human: false,
          reasoning: "Wrong size on infant_clothing, standard.",
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
];

const models = ["openai/gpt-oss-120b:free"];

async function main() {
  const prompt: PromptUnderTest = {
    name: "responder-en-v1",
    system_message: RESPONDER_EN_SYSTEM_MESSAGE,
    user_template: responderEnUserTemplate,
    response_format_json: true,
  };

  const summary = await runHarness(prompt, models, inputs);

  console.log("\n=== RESPONDER EN V1 RUN SUMMARY ===");
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