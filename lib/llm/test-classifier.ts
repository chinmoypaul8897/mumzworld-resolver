import { runHarness, type PromptUnderTest, type TestInput, type RunResult } from "./harness";
import { CLASSIFIER_SYSTEM_MESSAGE, classifierUserTemplate } from "../prompts/classifier";
import { mockOrders } from "../data/mock-orders";

/**
 * Run classifier prompt v1 across 3 candidate models with 5 test inputs.
 *
 * Inputs designed to stress different dimensions:
 * CL1 — clean english delivery delay (baseline)
 * CL2 — arabic damaged car seat (arabic + safety routing)
 * CL3 — code-switched panicked formula (language + urgency + emotion)
 * CL4 — vague unclear complaint (unclear handling)
 * CL5 — out-of-scope medical question (out_of_scope handling)
 */

const ordersById = Object.fromEntries(mockOrders.map((o) => [o.order_id, o]));

const inputs: TestInput[] = [
  {
    id: "CL1",
    description: "EN — diapers late delivery (M44781)",
    user_message:
      "My priority order was supposed to come yesterday and I still haven't received it. I need diapers.",
    context: JSON.stringify(ordersById["M44781"], null, 2),
  },
  {
    id: "CL2",
    description: "AR — damaged stroller (M44889)",
    user_message: "العربة وصلت مع عجلة مكسورة، ما يمديني أستخدمها مع طفلي عمره ٣ شهور",
    context: JSON.stringify(ordersById["M44889"], null, 2),
  },
  {
    id: "CL3",
    description: "MIXED — panicked formula late (M44521 Fatima)",
    user_message:
      "yaani the order كان supposed to come yesterday and خلاص my baby has only 2 feeds left, please help",
    context: JSON.stringify(ordersById["M44521"], null, 2),
  },
  {
    id: "CL4",
    description: "EN — vague unclear (M44712)",
    user_message: "the thing isn't right, idk",
    context: JSON.stringify(ordersById["M44712"], null, 2),
  },
  {
    id: "CL5",
    description: "EN — out-of-scope medical (M44823)",
    user_message: "Is this formula safe for my baby with reflux?",
    context: JSON.stringify(ordersById["M44823"], null, 2),
  },
];

const models = [
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.5:free",
];

async function main() {
  const prompt: PromptUnderTest = {
    name: "classifier-v1",
    system_message: CLASSIFIER_SYSTEM_MESSAGE,
    user_template: classifierUserTemplate,
    response_format_json: true,
  };

  const summary = await runHarness(prompt, models, inputs);

  console.log("\n=== CLASSIFIER V1 RUN SUMMARY ===");
  console.log(`Total runs: ${summary.results.length}`);
  console.log(`Parse-OK: ${summary.results.filter((r: RunResult) => r.parse_ok).length}`);
  console.log(`Parse-fail: ${summary.results.filter((r: RunResult) => !r.parse_ok).length}`);
  console.log(`Errors: ${summary.results.filter((r: RunResult) => r.error).length}`);

  console.log("\nPer-model breakdown:");
  for (const model of models) {
    const modelResults = summary.results.filter((r: RunResult) => r.model === model);
    const okCount = modelResults.filter((r: RunResult) => r.parse_ok).length;
    const errCount = modelResults.filter((r: RunResult) => r.error).length;
    const avgLatency =
      modelResults
        .filter((r: RunResult) => r.response)
        .reduce((acc: number, r: RunResult) => acc + (r.response?.latency_ms ?? 0), 0) /
      modelResults.filter((r: RunResult) => r.response).length;
    console.log(
      `  ${model}: ${okCount}/${modelResults.length} parse-OK, ${errCount} errors, avg ${Math.round(avgLatency)}ms`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});