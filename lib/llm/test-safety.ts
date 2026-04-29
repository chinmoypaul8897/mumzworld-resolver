import { runHarness, type PromptUnderTest, type TestInput, type RunResult } from "./harness";
import { SAFETY_SYSTEM_MESSAGE, safetyUserTemplate } from "../prompts/safety";

/**
 * Run safety classifier prompt v1 against gpt-oss-120b on 6 inputs:
 *
 * S1 — formula warm, baby drank some, fussy (3c + 3d combined, critical)
 * S2 — damaged car seat, no use yet (3b, critical, no disclaimer)
 * S3 — wrong size onesies (no safety, false alert check)
 * S4 — out-of-scope medical (no product safety, but disclaimer)
 * S5 — slight temperature warm on formula (4a soft rule, warning)
 * S6 — vague unclear (4c, no alert, info-level)
 *
 * 6 inputs (not 5) because the safety classifier is the most
 * consequential prompt — over-coverage is intentional.
 */

const inputs: TestInput[] = [
  {
    id: "S1",
    description: "formula warm + baby ingested + symptoms (critical, all flags)",
    user_message: "the formula came warm. baby drank some about an hour ago. now seems fussy",
    context: JSON.stringify(
      {
        issue_type: "quality_concern",
        product_category: "infant_consumables",
        urgency_tier: "safety_critical",
        confidence: 0.91,
      },
      null,
      2
    ),
  },
  {
    id: "S2",
    description: "cracked car seat, no use yet (critical, no disclaimer)",
    user_message:
      "I just got my baby's car seat delivered today and the side has a crack in the plastic shell.",
    context: JSON.stringify(
      {
        issue_type: "damaged_item",
        product_category: "infant_safety_critical",
        urgency_tier: "safety_critical",
        confidence: 0.96,
      },
      null,
      2
    ),
  },
  {
    id: "S3",
    description: "wrong size onesies (no safety alert)",
    user_message:
      "Got the onesies today but it's the wrong size — ordered 6-9m and these are 0-3m. Can I exchange?",
    context: JSON.stringify(
      {
        issue_type: "wrong_item",
        product_category: "infant_clothing",
        urgency_tier: "standard",
        confidence: 0.93,
      },
      null,
      2
    ),
  },
  {
    id: "S4",
    description: "out-of-scope medical (no product safety, but disclaimer)",
    user_message: "Is this formula safe for my baby with reflux?",
    context: JSON.stringify(
      {
        issue_type: "out_of_scope",
        product_category: "infant_consumables",
        urgency_tier: "standard",
        confidence: 0.96,
      },
      null,
      2
    ),
  },
  {
    id: "S5",
    description: "slightly warm formula, no symptoms (soft rule, warning)",
    user_message:
      "the formula tin felt a bit warm when it arrived. baby hasn't had any yet. should I be worried?",
    context: JSON.stringify(
      {
        issue_type: "quality_concern",
        product_category: "infant_consumables",
        urgency_tier: "time_sensitive",
        confidence: 0.85,
      },
      null,
      2
    ),
  },
  {
    id: "S6",
    description: "vague unclear (no alert, info-level if any)",
    user_message: "the thing isn't right, idk",
    context: JSON.stringify(
      {
        issue_type: "unclear",
        product_category: "unknown",
        urgency_tier: "standard",
        confidence: 0.62,
      },
      null,
      2
    ),
  },
];

const models = ["openai/gpt-oss-120b:free"];

async function main() {
  const prompt: PromptUnderTest = {
    name: "safety-v1",
    system_message: SAFETY_SYSTEM_MESSAGE,
    user_template: safetyUserTemplate,
    response_format_json: true,
  };

  const summary = await runHarness(prompt, models, inputs);

  console.log("\n=== SAFETY CLASSIFIER V1 RUN SUMMARY ===");
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