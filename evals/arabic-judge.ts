import fs from "fs";
import path from "path";
import { chat } from "@/lib/llm/openai";

/**
 * Arabic LLM-as-judge.
 *
 * Reads the latest eval run, finds AR-tier cases, asks gpt-4o-mini to
 * score the responder's Arabic output on tone, register, and natural
 * mom-readability.
 *
 * Limitation: this is a soft signal, not ground truth. Neither author
 * reads Arabic natively. The judge is gpt-4o-mini — a separate model
 * family from the responder, which reduces (but doesn't eliminate)
 * self-bias. Documented in EVALS.md.
 */

const JUDGE_SYSTEM = `You are a fluent native speaker of Arabic, evaluating customer service responses written by an AI for a Middle East e-commerce platform. You read Modern Standard Arabic (MSA), Levantine, Gulf, and Egyptian dialects naturally.

You receive:
- The mother's original message (in Arabic)
- The AI's response to her (in Arabic)

You score the AI's response on 4 dimensions, each 0 or 1:

1. **dialect_match**: did the AI respond in the same dialect/register the mother wrote in? (Mother wrote Gulf → AI should respond Gulf, not formal MSA. Mother wrote MSA → AI should respond MSA. Mixed/code-switched → AI may default to simplified MSA.)

2. **register_match**: did the AI match the formality level? (Mother used casual/emotional tone → AI should be conversational, not stiff. Mother used formal language → AI should be polished.)

3. **mom_natural**: would a real Arabic-speaking mother find this AI response natural and not robotic? (Stilted MSA in a casual context = no. Smooth conversational tone = yes. Apology theatre or corporate jargon = no.)

4. **action_clear**: is the next step clear to the mother in plain language? (Vague, hedged, or jargon-heavy = no. Concrete and direct = yes.)

You return ONLY a JSON object matching this exact schema. No markdown, no commentary, no code fences.

{
  "dialect_match": 0 | 1,
  "register_match": 0 | 1,
  "mom_natural": 0 | 1,
  "action_clear": 0 | 1,
  "reasoning_en": string (1-2 sentences in English explaining your scores)
}`;

interface JudgeScore {
  dialect_match: number;
  register_match: number;
  mom_natural: number;
  action_clear: number;
  reasoning_en: string;
}

interface JudgedCase {
  case_id: string;
  mom_message: string;
  ai_response_headline: string;
  ai_response_full: string;
  total_score: number;
  max_score: number;
  scores: JudgeScore;
}

async function main() {
  // Find latest eval run
  const resultsDir = path.resolve("evals/results");
  const files = fs
    .readdirSync(resultsDir)
    .filter((f) => f.startsWith("eval-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    console.error("No eval runs found. Run `npx tsx evals/run-evals.ts` first.");
    process.exit(1);
  }
  const latest = files[files.length - 1];
  console.log(`Reading latest eval: ${latest}\n`);
  const evalData = JSON.parse(fs.readFileSync(path.join(resultsDir, latest), "utf8"));

  // Find AR-language cases that produced output
  const arCases = evalData.runs.filter(
    (r: any) => r.result?.classification?.language === "ar" && r.score.schema_valid
  );

  if (arCases.length === 0) {
    console.log("No Arabic cases found in latest eval run.");
    return;
  }

  console.log(`Found ${arCases.length} AR cases to judge.\n`);

  const judged: JudgedCase[] = [];

  for (const r of arCases) {
    const momMessage = r.result.classification.reasoning
      ? r.result.classification.reasoning
      : "(see test case)";
    const responseFullStr = JSON.stringify(
      {
        headline: r.result.resolution.headline,
        immediate_action: r.result.resolution.immediate_action,
        what_we_did: r.result.resolution.what_we_did,
        what_happens_next: r.result.resolution.what_happens_next,
      },
      null,
      2
    );

    // Pull the original message from the input
    const inputCase = JSON.parse(fs.readFileSync("evals/test-cases.json", "utf8")).cases.find(
      (c: any) => c.id === r.case_id
    );
    const originalMessage = inputCase?.message ?? "(unknown)";

    process.stdout.write(`Judging ${r.case_id}... `);

    const userMessage = `MOTHER'S ORIGINAL MESSAGE (Arabic):
${originalMessage}

AI's RESPONSE (Arabic, JSON-formatted for clarity):
${responseFullStr}

Return the JSON score now.`;

    try {
      const response = await chat({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: JUDGE_SYSTEM },
          { role: "user", content: userMessage },
        ],
        response_format_json: true,
      });

      const parsed = JSON.parse(response.text) as JudgeScore;
      const total =
        parsed.dialect_match + parsed.register_match + parsed.mom_natural + parsed.action_clear;

      judged.push({
        case_id: r.case_id,
        mom_message: originalMessage,
        ai_response_headline: r.result.resolution.headline,
        ai_response_full: responseFullStr,
        total_score: total,
        max_score: 4,
        scores: parsed,
      });

      console.log(`${total}/4`);
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`);
    }
  }

  // Save results
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(resultsDir, `arabic-judge-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(judged, null, 2));

  // Print summary
  const totalPassed = judged.reduce((acc, j) => acc + j.total_score, 0);
  const totalMax = judged.reduce((acc, j) => acc + j.max_score, 0);
  const pct = totalMax > 0 ? Math.round((totalPassed / totalMax) * 1000) / 10 : 0;

  console.log(`\n=== ARABIC JUDGE SUMMARY ===`);
  console.log(`Cases judged: ${judged.length}`);
  console.log(`Total score: ${totalPassed}/${totalMax} (${pct}%)`);
  console.log(`Saved to ${outPath}`);

  console.log(`\nPer-case detail:`);
  for (const j of judged) {
    console.log(`\n  ${j.case_id} — ${j.total_score}/4`);
    console.log(`    dialect_match=${j.scores.dialect_match}, register_match=${j.scores.register_match}, mom_natural=${j.scores.mom_natural}, action_clear=${j.scores.action_clear}`);
    console.log(`    judge: ${j.scores.reasoning_en}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});