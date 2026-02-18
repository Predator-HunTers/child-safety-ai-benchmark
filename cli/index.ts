#!/usr/bin/env bun
/** Child Safety Benchmark CLI — evaluate models on child safety test suites. */

import { resolve } from "path";
import { parseArgs } from "util";
import { runBenchmark } from "./runner.js";
import { OpenRouterModel, listOpenRouterModels } from "./models/openrouter.js";
import { LocalSklearnModel } from "./models/local-sklearn.js";
import { LocalOnnxModel } from "./models/local-onnx.js";
import { SafeViewServerModel } from "./models/safeview-server.js";
import type { BaseModel, TestSuite } from "./models/base.js";
import type { BenchmarkRun } from "./report.js";

const SUITES_DIR = resolve(import.meta.dir, "../suites");

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    suite: { type: "string", short: "s" },
    model: { type: "string", short: "m" },
    concurrency: { type: "string", short: "c" },
    "real-case-count": { type: "string", short: "r" },
    verbose: { type: "boolean", short: "v", default: false },
    list: { type: "boolean", short: "l", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help || (!values.suite && !values.list)) {
  console.log(`
Child Safety Benchmark CLI

Usage:
  bun run cli/index.ts --suite <name> --model <name> [options]

Options:
  -s, --suite <name>        Test suite (comma-separated for multiple):
                             grooming, grooming-real, nsfw, health-risk, stranger-meeting
  -m, --model <name>        Model to evaluate (see --list)
  -c, --concurrency <n>     Concurrent requests (default: 5)
  -r, --real-case-count <n> Limit real-case suites to first N cases (default: 1)
  -v, --verbose             Show detailed progress
  -l, --list                List available models and suites
  -h, --help                Show this help

Models:
  Local:
    v1-sklearn              sklearn TF-IDF + LogisticRegression (via Python)
    v3-deberta-onnx         DeBERTa-v3-small ONNX (via Python)
    safeview-server         SafeView Shield FastAPI server

  OpenRouter (requires OPENROUTER_API_KEY):
    openrouter:<model>      e.g. openrouter:claude-opus-4.6
    Available: ${listOpenRouterModels().join(", ")}

Examples:
  bun run cli/index.ts --suite grooming --model safeview-server
  bun run cli/index.ts --suite grooming-real --model openrouter:claude-opus-4.6
  bun run cli/index.ts --suite grooming-real --model openrouter:gpt-5 -r 5
  bun run cli/index.ts --suite grooming-real -r 10 --model openrouter:gpt-5 -v
  bun run cli/index.ts --suite grooming --model v1-sklearn
  `);
  process.exit(0);
}

if (values.list) {
  console.log("\nAvailable test suites:");
  const suiteFiles = new Bun.Glob("*.json").scanSync(SUITES_DIR);
  for (const f of suiteFiles) {
    const name = f.replace(".json", "");
    const suite = await Bun.file(resolve(SUITES_DIR, f)).json();
    console.log(`  ${name.padEnd(20)} ${suite.tests?.length ?? "?"} tests — ${suite.description ?? ""}`);
  }

  console.log("\nAvailable models:");
  console.log("  Local:");
  console.log("    v1-sklearn           sklearn TF-IDF + LogisticRegression");
  console.log("    v3-deberta-onnx      DeBERTa-v3-small ONNX");
  console.log("    safeview-server      SafeView Shield API");
  console.log("  OpenRouter:");
  for (const m of listOpenRouterModels()) {
    console.log(`    openrouter:${m}`);
  }
  process.exit(0);
}

// Parse suite names (comma-separated)
const suiteNames = values.suite!.split(",").map((s) => s.trim()).filter(Boolean);

// Create model
const modelArg = values.model ?? "safeview-server";
let model: BaseModel;

if (modelArg === "v1-sklearn") {
  model = new LocalSklearnModel();
} else if (modelArg === "v3-deberta-onnx") {
  model = new LocalOnnxModel();
} else if (modelArg === "safeview-server") {
  model = new SafeViewServerModel();
} else if (modelArg.startsWith("openrouter:")) {
  const modelName = modelArg.slice("openrouter:".length);
  model = new OpenRouterModel(modelName);
} else {
  console.error(`Unknown model: ${modelArg}`);
  console.error("Use --list to see available models, or --help for usage.");
  process.exit(1);
}

console.log(`Model: ${model.name} (${model.provider})`);

// Run each suite
const runs: BenchmarkRun[] = [];

for (const suiteName of suiteNames) {
  const suitePath = resolve(SUITES_DIR, `${suiteName}.json`);
  const suiteFile = Bun.file(suitePath);

  if (!(await suiteFile.exists())) {
    console.error(`Suite not found: ${suitePath}`);
    console.error("Use --list to see available suites.");
    process.exit(1);
  }

  const suite: TestSuite = await suiteFile.json();

  // Filter real-case suites to first N unique cases
  const realCaseCount = parseInt(values["real-case-count"] ?? "1", 10);
  const hasRealCases = suite.tests.some((t) => t.source === "real" && t.case_id);
  if (hasRealCases && realCaseCount > 0) {
    const seenCases = new Set<string>();
    suite.tests = suite.tests.filter((t) => {
      if (t.source !== "real" || !t.case_id) return true; // keep non-real tests
      if (seenCases.has(t.case_id)) {
        return seenCases.size <= realCaseCount; // keep chunks of already-included cases
      }
      if (seenCases.size >= realCaseCount) return false;
      seenCases.add(t.case_id);
      return true;
    });
  }

  console.log(`\nLoaded suite: ${suite.suite} v${suite.version} (${suite.tests.length} tests)`);
  console.log(`Description: ${suite.description}`);
  if (hasRealCases) {
    const uniqueCases = new Set(suite.tests.filter((t) => t.source === "real").map((t) => t.case_id));
    console.log(`Real cases: ${uniqueCases.size} of ${realCaseCount === Infinity ? "all" : realCaseCount} requested`);
  }

  const run = await runBenchmark({
    suite,
    model,
    concurrency: values.concurrency ? parseInt(values.concurrency, 10) : 5,
    verbose: values.verbose,
  });

  runs.push(run);

  // Show per-category breakdown for this suite
  console.log(`\nPer-category breakdown (${suiteName}):`);
  for (const [cat, m] of Object.entries(run.metrics.per_category)) {
    console.log(
      `  ${cat.padEnd(25)} Score=${(m.f1 * 100).toFixed(1)}%  Correct=${(m.precision * 100).toFixed(1)}%  Caught=${(m.recall * 100).toFixed(1)}%  (n=${m.count})`
    );
  }

  // Show example explanations
  const interestingPredictions = run.predictions
    .filter((p) => p.explanation && p.explanation.length > 10)
    .slice(0, 5);

  if (interestingPredictions.length > 0) {
    console.log("\nSample explanations (why the model classified this way):");
    for (const p of interestingPredictions) {
      const correctness = p.expected === p.predicted ? "CORRECT" : "WRONG";
      const label = p.predicted ? "GROOMING" : "SAFE";
      console.log(`  [${correctness}] ${p.test_id} -> ${label}`);
      console.log(`    Stages: ${p.stages_predicted.join(", ") || "none"}`);
      console.log(`    Why: ${p.explanation}`);
      console.log();
    }
  }
}

// Combined summary when multiple suites were run
if (runs.length > 1) {
  console.log("\n" + "=".repeat(60));
  console.log("  COMBINED RESULTS ACROSS ALL SUITES");
  console.log("=".repeat(60));

  let totalTP = 0, totalFP = 0, totalFN = 0, totalTN = 0;
  let totalTests = 0;

  for (const run of runs) {
    totalTP += run.metrics.tp;
    totalFP += run.metrics.fp;
    totalFN += run.metrics.fn;
    totalTN += run.metrics.tn;
    totalTests += run.metrics.total;
  }

  const accuracy = totalTests > 0 ? (totalTP + totalTN) / totalTests : 0;
  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  console.log(`\n  Total Tests:        ${totalTests}`);
  console.log(`  Overall Accuracy:   ${(accuracy * 100).toFixed(1)}%`);
  console.log(`  Correct Alerts:     ${(precision * 100).toFixed(1)}%`);
  console.log(`  Threats Caught:     ${(recall * 100).toFixed(1)}%`);
  console.log(`  Overall Score:      ${(f1 * 100).toFixed(1)}%`);
  console.log(
    `  Correctly Flagged=${totalTP}  False Alarms=${totalFP}  Missed Threats=${totalFN}  Correctly Cleared=${totalTN}`
  );

  console.log("\n  Per-suite summary:");
  for (const run of runs) {
    const m = run.metrics;
    console.log(
      `    ${run.suite.padEnd(20)} Score=${(m.f1 * 100).toFixed(1)}%  Accuracy=${(m.accuracy * 100).toFixed(1)}%  Caught=${(m.recall * 100).toFixed(1)}%  (n=${m.total})`
    );
  }
}
