import fs from "fs";
import path from "path";
import { resolve } from "@/lib/engine/orchestrator";
import { scoreCase, type TestCase, type CaseScore } from "./scorer";

interface EvalRun {
  case_id: string;
  tier: string;
  result: unknown | null;
  error: string | null;
  score: CaseScore;
  duration_ms: number;
}

interface EvalReport {
  run_at: string;
  total_cases: number;
  total_dimensions: number;
  passed_dimensions: number;
  pct: number;
  by_tier: Record<string, { cases: number; passed: number; max: number; pct: number }>;
  infra_failures: number;
  runs: EvalRun[];
}

async function main() {
  const fixturePath = path.resolve("evals/test-cases.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const cases: TestCase[] = fixture.cases;

  console.log(`Loaded ${cases.length} test cases. Starting eval run...\n`);

  const runs: EvalRun[] = [];

  for (const tc of cases) {
    const t0 = Date.now();
    let result: any = null;
    let error: string | null = null;
    process.stdout.write(`Running ${tc.id} (${tc.tier})... `);
    try {
      result = await resolve({ message: tc.message, order_id: tc.order_id });
    } catch (err) {
      error = (err as Error).message;
    }
    const duration_ms = Date.now() - t0;
    const score = scoreCase(tc, result, error ?? undefined);
    runs.push({
      case_id: tc.id,
      tier: tc.tier,
      result,
      error,
      score,
      duration_ms,
    });
    console.log(
      `${score.schema_valid ? "OK" : "FAIL"} ${score.total}/${score.max} (${duration_ms}ms)`
    );
  }

  const totalDimensions = runs.reduce((acc, r) => acc + r.score.max, 0);
  const passedDimensions = runs.reduce((acc, r) => acc + r.score.total, 0);
  const infraFailures = runs.filter((r) => !r.score.schema_valid).length;

  // Per-tier breakdown
  const byTier: EvalReport["by_tier"] = {};
  for (const r of runs) {
    byTier[r.tier] ??= { cases: 0, passed: 0, max: 0, pct: 0 };
    byTier[r.tier].cases += 1;
    byTier[r.tier].passed += r.score.total;
    byTier[r.tier].max += r.score.max;
  }
  for (const tier of Object.keys(byTier)) {
    const t = byTier[tier];
    t.pct = t.max > 0 ? Math.round((t.passed / t.max) * 1000) / 10 : 0;
  }

  const report: EvalReport = {
    run_at: new Date().toISOString(),
    total_cases: cases.length,
    total_dimensions: totalDimensions,
    passed_dimensions: passedDimensions,
    pct: totalDimensions > 0 ? Math.round((passedDimensions / totalDimensions) * 1000) / 10 : 0,
    by_tier: byTier,
    infra_failures: infraFailures,
    runs,
  };

  // Write JSON results
  const resultsDir = path.resolve("evals/results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const ts = report.run_at.replace(/[:.]/g, "-");
  const jsonPath = path.join(resultsDir, `eval-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(`\n=== EVAL RUN SUMMARY ===`);
  console.log(`Cases: ${report.total_cases}`);
  console.log(`Dimensions passed: ${report.passed_dimensions}/${report.total_dimensions} (${report.pct}%)`);
  console.log(`Infra failures (orchestrator threw): ${report.infra_failures}`);
  console.log(`\nBy tier:`);
  for (const [tier, t] of Object.entries(report.by_tier)) {
    console.log(`  ${tier}: ${t.passed}/${t.max} (${t.pct}%) across ${t.cases} cases`);
  }
  console.log(`\nResults saved to ${jsonPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});