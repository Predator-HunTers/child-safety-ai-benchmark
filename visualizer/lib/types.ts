/** Shared TypeScript types for the benchmark visualizer. */

export interface MetricsResult {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  fpr: number;
  fnr: number;
  total: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  total_cost_usd: number;
  per_category: Record<string, CategoryMetrics>;
}

export interface CategoryMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  count: number;
}

export interface Prediction {
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
}

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
  predictions: Prediction[];
}

/** Detect why a run scored 0% — refused, errored, or genuinely failed. */
export type FailureReason =
  | { type: "ok" }
  | { type: "refused"; description: string }
  | { type: "api_error"; description: string; errorCount: number }
  | { type: "all_errors"; description: string; errorCount: number };

export function detectFailureReason(run: BenchmarkRun): FailureReason {
  const { tp, fp, fn } = run.metrics;
  const preds = run.predictions ?? [];

  // Count predictions that have error explanations
  const errorPreds = preds.filter(
    (p) => p.explanation?.startsWith("Error:") || p.explanation?.includes("API error")
  );

  // All tests errored (e.g. 413 request too large)
  if (errorPreds.length > 0 && errorPreds.length === preds.length) {
    const is413 = errorPreds.some((p) => p.explanation?.includes("413"));
    return {
      type: "all_errors",
      description: is413
        ? "All requests failed — input too large for this model's API limit"
        : "All requests failed due to API errors",
      errorCount: errorPreds.length,
    };
  }

  // Some errors but not all
  if (errorPreds.length > 0 && tp === 0 && fp === 0 && fn > 0) {
    return {
      type: "api_error",
      description: `${errorPreds.length} of ${preds.length} requests failed due to API errors`,
      errorCount: errorPreds.length,
    };
  }

  // Model responded to every request but never flagged anything positive
  if (tp === 0 && fp === 0 && fn > 0 && errorPreds.length === 0) {
    return {
      type: "refused",
      description:
        "Model classified every conversation as safe — likely blocked by safety guardrails that prevent grooming classification",
    };
  }

  return { type: "ok" };
}
