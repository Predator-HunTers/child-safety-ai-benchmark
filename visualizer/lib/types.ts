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
