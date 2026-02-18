/** Concurrent model evaluation orchestrator. */

import type { BaseModel, ModelResult, TestCase, TestSuite } from "./models/base.js";
import { computeMetrics } from "./metrics.js";
import { buildRun, generateRunId, saveReport, type BenchmarkRun } from "./report.js";

const CONCURRENCY = 5;

export interface RunOptions {
  suite: TestSuite;
  model: BaseModel;
  concurrency?: number;
  verbose?: boolean;
}

export async function runBenchmark(opts: RunOptions): Promise<BenchmarkRun> {
  const { suite, model, verbose = false } = opts;
  const concurrency = opts.concurrency ?? CONCURRENCY;
  const tests = suite.tests;
  const results: ModelResult[] = new Array(tests.length);
  const errors: Array<{ index: number; error: string }> = [];

  console.log(
    `\nRunning ${suite.suite} benchmark (${tests.length} tests) with ${model.name}...`
  );
  console.log(`Concurrency: ${concurrency}\n`);

  let completed = 0;
  const startTime = performance.now();

  // Process tests with bounded concurrency
  const queue = tests.map((test, index) => ({ test, index }));
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        results[item.index] = await model.predict(item.test);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ index: item.index, error: errMsg });
        // Create a failed result
        results[item.index] = {
          prediction: {
            is_grooming: false,
            stages: [],
            severity: 0,
            explanation: `Error: ${errMsg}`,
          },
          latency_ms: 0,
        };
      }

      completed++;
      if (verbose || completed % 10 === 0 || completed === tests.length) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        const pct = ((completed / tests.length) * 100).toFixed(0);
        process.stdout.write(
          `\r  Progress: ${completed}/${tests.length} (${pct}%) [${elapsed}s]`
        );
      }
    }
  });

  await Promise.all(workers);
  console.log("\n");

  if (errors.length > 0) {
    console.log(`  Errors: ${errors.length} tests failed`);
    if (verbose) {
      for (const e of errors.slice(0, 5)) {
        console.log(`    Test #${e.index}: ${e.error}`);
      }
    }
  }

  // Compute metrics
  const evalEntries = tests.map((test, i) => {
    const result = results[i];
    const expectedPositive = Boolean(
      (test.expected as Record<string, unknown>).is_grooming ??
        (test.expected as Record<string, unknown>).is_meeting_request ??
        (test.expected as Record<string, unknown>).is_health_risk ??
        (test.expected as Record<string, unknown>).is_nsfw
    );

    return {
      test_id: test.id,
      category: test.category,
      expected: expectedPositive,
      predicted: result.prediction.is_grooming,
      score: result.prediction.severity,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_usd ?? 0,
    };
  });

  const metrics = computeMetrics(evalEntries);

  // Build and save report
  const runId = generateRunId();
  const run = buildRun(
    runId,
    suite.suite,
    model.name,
    model.provider,
    tests,
    results,
    metrics
  );

  const filepath = await saveReport(run);

  // Print summary
  console.log(`  Results for ${model.name} on ${suite.suite}:`);
  console.log(`  ──────────────────────────────────`);
  console.log(`  Overall Accuracy:   ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`  Correct Alerts:     ${(metrics.precision * 100).toFixed(1)}%  (when it flags grooming, how often is it right?)`);
  console.log(`  Threats Caught:     ${(metrics.recall * 100).toFixed(1)}%  (of all real grooming, what % detected?)`);
  console.log(`  Overall Score:      ${(metrics.f1 * 100).toFixed(1)}%  (balanced measure of detection quality)`);
  console.log(`  Confidence:         ${metrics.auc.toFixed(3)}  (how well it separates threats from safe)`);
  console.log(
    `  False Alarm Rate:   ${(metrics.fpr * 100).toFixed(1)}% | Missed Threat Rate: ${(metrics.fnr * 100).toFixed(1)}%`
  );
  console.log(
    `  Correctly Flagged=${metrics.tp}  False Alarms=${metrics.fp}  Missed Threats=${metrics.fn}  Correctly Cleared=${metrics.tn}`
  );
  console.log(`  Avg latency: ${metrics.avg_latency_ms.toFixed(0)}ms (p95: ${metrics.p95_latency_ms.toFixed(0)}ms)`);
  if (metrics.total_cost_usd > 0) {
    console.log(`  Total cost:  $${metrics.total_cost_usd.toFixed(4)}`);
  }

  // Source breakdown (real vs synthetic)
  if (run.source_breakdown) {
    const { real, synthetic } = run.source_breakdown;
    if (real.count > 0) {
      console.log(`\n  Real Chat Log Results (${real.count} cases from convicted predators):`);
      console.log(`    Overall Score:    ${(real.f1 * 100).toFixed(1)}%`);
      console.log(`    Threats Caught:   ${(real.recall * 100).toFixed(1)}%`);
      console.log(`    Correct Alerts:   ${(real.precision * 100).toFixed(1)}%`);
      console.log(`    Overall Accuracy: ${(real.accuracy * 100).toFixed(1)}%`);
    }
    if (synthetic.count > 0) {
      console.log(`\n  Synthetic Test Results (${synthetic.count} cases):`);
      console.log(`    Overall Score:    ${(synthetic.f1 * 100).toFixed(1)}%`);
      console.log(`    Threats Caught:   ${(synthetic.recall * 100).toFixed(1)}%`);
      console.log(`    Correct Alerts:   ${(synthetic.precision * 100).toFixed(1)}%`);
      console.log(`    Overall Accuracy: ${(synthetic.accuracy * 100).toFixed(1)}%`);
    }
  }

  // Stage detection summary
  if (run.stage_summary && Object.keys(run.stage_summary).length > 0) {
    console.log(`\n  Grooming Stages Detected:`);
    const stages = Object.entries(run.stage_summary).sort(
      (a, b) => b[1].expected - a[1].expected
    );
    for (const [stage, counts] of stages) {
      const pct = counts.expected > 0
        ? ((counts.detected / counts.expected) * 100).toFixed(1)
        : "N/A";
      const bar = counts.expected > 0
        ? `${counts.detected}/${counts.expected} caught (${pct}%)`
        : "(no test cases)";
      console.log(`    ${stage.padEnd(28)} ${bar}`);
    }
  }

  console.log(`\n  Report saved: ${filepath}`);

  return run;
}
