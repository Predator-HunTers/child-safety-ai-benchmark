/** Generate JSON result reports for the visualizer. */

import { resolve } from "path";
import type { MetricsResult } from "./metrics.js";
import type { ModelResult, TestCase } from "./models/base.js";

export interface StageSummaryEntry {
  expected: number;
  detected: number;
}

export interface SourceMetrics {
  count: number;
  f1: number;
  precision: number;
  recall: number;
  accuracy: number;
}

export interface BenchmarkRun {
  id: string;
  timestamp: string;
  suite: string;
  model: string;
  provider: string;
  metrics: MetricsResult;
  stage_summary?: Record<string, StageSummaryEntry>;
  source_breakdown?: {
    real: SourceMetrics;
    synthetic: SourceMetrics;
  };
  predictions: Array<{
    test_id: string;
    category: string;
    source?: "real" | "synthetic";
    case_id?: string;
    expected: boolean;
    predicted: boolean;
    score: number;
    stages_expected: string[];
    stages_predicted: string[];
    latency_ms: number;
    cost_usd: number;
    explanation?: string;
  }>;
}

export function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}`;
}

export async function saveReport(run: BenchmarkRun): Promise<string> {
  const outputDir = resolve(import.meta.dir, "../output");
  const filename = `${run.suite}_${run.model}_${run.id}.json`;
  const filepath = resolve(outputDir, filename);

  await Bun.write(filepath, JSON.stringify(run, null, 2));

  return filepath;
}

export function buildRun(
  runId: string,
  suite: string,
  modelName: string,
  provider: string,
  tests: TestCase[],
  results: ModelResult[],
  metrics: MetricsResult
): BenchmarkRun {
  const predictions = tests.map((test, i) => {
    const result = results[i];
    const expectedGrooming = Boolean(
      (test.expected as Record<string, unknown>).is_grooming ??
        (test.expected as Record<string, unknown>).is_meeting_request ??
        (test.expected as Record<string, unknown>).is_health_risk ??
        (test.expected as Record<string, unknown>).is_nsfw
    );

    return {
      test_id: test.id,
      category: test.category,
      source: test.source as "real" | "synthetic" | undefined,
      case_id: test.case_id,
      expected: expectedGrooming,
      predicted: result.prediction.is_grooming,
      score: result.prediction.severity,
      stages_expected: (
        (test.expected as Record<string, unknown>).stages ?? []
      ) as string[],
      stages_predicted: result.prediction.stages,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_usd ?? 0,
      explanation: result.prediction.explanation,
    };
  });

  // Compute stage detection summary
  const stageSummary: Record<string, StageSummaryEntry> = {};
  for (const pred of predictions) {
    for (const stage of pred.stages_expected) {
      if (!stageSummary[stage]) stageSummary[stage] = { expected: 0, detected: 0 };
      stageSummary[stage].expected++;
    }
    for (const stage of pred.stages_predicted) {
      if (pred.stages_expected.includes(stage)) {
        if (!stageSummary[stage]) stageSummary[stage] = { expected: 0, detected: 0 };
        stageSummary[stage].detected++;
      }
    }
  }

  // Compute source breakdown if any predictions have a source tag
  const hasSourceTags = predictions.some((p) => p.source);
  let source_breakdown: BenchmarkRun["source_breakdown"] = undefined;
  if (hasSourceTags) {
    const computeSourceMetrics = (
      preds: typeof predictions
    ): SourceMetrics => {
      let tp = 0,
        fp = 0,
        fn = 0,
        tn = 0;
      for (const p of preds) {
        if (p.expected && p.predicted) tp++;
        else if (!p.expected && p.predicted) fp++;
        else if (p.expected && !p.predicted) fn++;
        else tn++;
      }
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      return {
        count: preds.length,
        f1:
          precision + recall > 0
            ? (2 * precision * recall) / (precision + recall)
            : 0,
        precision,
        recall,
        accuracy: preds.length > 0 ? (tp + tn) / preds.length : 0,
      };
    };

    const realPreds = predictions.filter((p) => p.source === "real");
    const syntheticPreds = predictions.filter((p) => p.source !== "real");

    if (realPreds.length > 0 || syntheticPreds.length > 0) {
      source_breakdown = {
        real: computeSourceMetrics(realPreds),
        synthetic: computeSourceMetrics(syntheticPreds),
      };
    }
  }

  return {
    id: runId,
    timestamp: new Date().toISOString(),
    suite,
    model: modelName,
    provider,
    metrics,
    stage_summary: Object.keys(stageSummary).length > 0 ? stageSummary : undefined,
    source_breakdown,
    predictions,
  };
}
