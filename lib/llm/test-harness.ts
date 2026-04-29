import { runHarness, type PromptUnderTest, type TestInput, type RunResult } from "./harness";

/**
 * Smoke test for the harness. Runs one trivial prompt against
 * one model with two inputs. Confirms the harness writes results
 * to lib/llm/runs/ and parses JSON correctly.
 *
 * Run with: npx tsx lib/llm/test-harness.ts
 */
async function main() {
  const prompt: PromptUnderTest = {
    name: "harness-smoke-test",
    system_message:
      "You return only valid JSON of the form {\"echo\": \"<input>\", \"length\": <n>} where n is the character count of the input. No prose, no explanation, no code fences.",
    user_template: (input: TestInput) => input.user_message,
    response_format_json: true,
  };

  const inputs: TestInput[] = [
    { id: "T1", description: "trivial english", user_message: "hello world" },
    { id: "T2", description: "trivial arabic", user_message: "مرحبا" },
  ];

  const summary = await runHarness(
    prompt,
    ["openai/gpt-oss-120b:free"],
    inputs
  );

  console.log("\n--- Summary ---");
  console.log(`Prompt: ${summary.prompt_name}`);
  console.log(`Total runs: ${summary.results.length}`);
  console.log(`Parse-OK: ${summary.results.filter((r: RunResult) => r.parse_ok).length}`);
  console.log(`Parse-fail: ${summary.results.filter((r: RunResult) => !r.parse_ok).length}`);
  console.log(`Errors: ${summary.results.filter((r: RunResult) => r.error).length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});