import fs from "fs";
import path from "path";
import { chat, type ChatMessage, type ChatResponse } from "./openrouter";

/**
 * Test harness — runs a prompt against multiple models with multiple
 * inputs, saves results to JSON, returns a structured table for
 * inspection.
 *
 * Use this in step 3.4 (classifier prompt comparison),
 * step 3.7 (responder), step 3.9 (safety).
 */

export interface TestInput {
  id: string;                   // e.g., "E1", "S1", "A2" — matches eval test cases
  description: string;          // human-readable label
  user_message: string;         // mom's complaint text
  context?: string;             // optional extra context (order JSON, etc.)
}

export interface PromptUnderTest {
  name: string;                 // e.g., "classifier-v1"
  system_message: string;
  user_template: (input: TestInput) => string;
  response_format_json?: boolean;
}

export interface RunResult {
  input_id: string;
  model: string;
  prompt_name: string;
  response: ChatResponse | null;
  parse_ok: boolean;
  parsed: unknown;
  parse_error?: string;
  error?: string;
}

export interface RunSummary {
  prompt_name: string;
  models: string[];
  inputs: TestInput[];
  results: RunResult[];
  started_at: string;
  ended_at: string;
}

/**
 * Try to parse the model's output as JSON. Tolerates common patterns
 * like ```json fences and stray prose around the JSON.
 */
function tryParseJson(text: string): { ok: boolean; value?: unknown; error?: string } {
  // Strip code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Find the outermost { ... } block in case there's prose around it
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return { ok: false, error: "No JSON object found in output" };
  }
  const jsonText = candidate.slice(firstBrace, lastBrace + 1);

  try {
    return { ok: true, value: JSON.parse(jsonText) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Run one prompt across all (model, input) combinations.
 * Saves results to lib/llm/runs/{prompt_name}-{timestamp}.json
 */
export async function runHarness(
  prompt: PromptUnderTest,
  models: string[],
  inputs: TestInput[]
): Promise<RunSummary> {
  const started_at = new Date().toISOString();
  const results: RunResult[] = [];

  for (const model of models) {
    for (const input of inputs) {
      console.log(`Running ${model} on ${input.id}...`);
      const messages: ChatMessage[] = [
        { role: "system", content: prompt.system_message },
        { role: "user", content: prompt.user_template(input) },
      ];

      try {
        const response = await chat({
          model,
          messages,
          response_format_json: prompt.response_format_json,
        });
        const parsed = tryParseJson(response.text);
        results.push({
          input_id: input.id,
          model,
          prompt_name: prompt.name,
          response,
          parse_ok: parsed.ok,
          parsed: parsed.value,
          parse_error: parsed.error,
        });
        const tokens = `${response.prompt_tokens}+${response.completion_tokens}`;
        console.log(
          `  ${parsed.ok ? "OK" : "PARSE_FAIL"}  ${response.latency_ms}ms  ${tokens}t`
        );
      } catch (err) {
        results.push({
          input_id: input.id,
          model,
          prompt_name: prompt.name,
          response: null,
          parse_ok: false,
          parsed: undefined,
          error: (err as Error).message,
        });
        console.log(`  ERROR  ${(err as Error).message.slice(0, 100)}`);
      }
    }
  }

  const ended_at = new Date().toISOString();
  const summary: RunSummary = {
    prompt_name: prompt.name,
    models,
    inputs,
    results,
    started_at,
    ended_at,
  };

  // Save to lib/llm/runs/
  const runsDir = path.join("lib", "llm", "runs");
  fs.mkdirSync(runsDir, { recursive: true });
  const timestamp = started_at.replace(/[:.]/g, "-");
  const filename = `${prompt.name}-${timestamp}.json`;
  fs.writeFileSync(path.join(runsDir, filename), JSON.stringify(summary, null, 2));
  console.log(`\nSaved results to lib/llm/runs/${filename}`);

  return summary;
}