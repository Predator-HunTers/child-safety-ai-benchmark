/** Client-side metrics recomputation — allows editing expected labels and rescoring without re-running the AI. */

import type {
  Prediction,
  MetricsResult,
  SourceMetrics,
  StageSummaryEntry,
  BenchmarkRun,
} from "./types";

function computeAUC(scores: Array<{ score: number; label: boolean }>): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const totalPos = sorted.filter((s) => s.label).length;
  const totalNeg = sorted.length - totalPos;
  if (totalPos === 0 || totalNeg === 0) return 0;
  let tpCount = 0, fpCount = 0, prevTPR = 0, prevFPR = 0, auc = 0;
  for (const s of sorted) {
    if (s.label) tpCount++;
    else fpCount++;
    const tpr = tpCount / totalPos;
    const fpr = fpCount / totalNeg;
    auc += ((fpr - prevFPR) * (tpr + prevTPR)) / 2;
    prevTPR = tpr;
    prevFPR = fpr;
  }
  return auc;
}

function computeMetricsFromPredictions(preds: Prediction[]): MetricsResult {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const latencies: number[] = [];
  let totalCost = 0;
  const scores: Array<{ score: number; label: boolean }> = [];

  for (const p of preds) {
    if (p.expected && p.predicted) tp++;
    else if (!p.expected && p.predicted) fp++;
    else if (p.expected && !p.predicted) fn++;
    else tn++;
    latencies.push(p.latency_ms);
    totalCost += p.cost_usd;
    scores.push({ score: p.score, label: p.expected });
  }

  const accuracy = preds.length > 0 ? (tp + tn) / preds.length : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;

  latencies.sort((a, b) => a - b);
  const avg_latency_ms = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  const p95_idx = Math.floor(latencies.length * 0.95);
  const p95_latency_ms = latencies[p95_idx] ?? 0;
  const auc = computeAUC(scores);

  const categories = [...new Set(preds.map((p) => p.category))];
  const per_category: MetricsResult["per_category"] = {};
  for (const cat of categories) {
    const catPreds = preds.filter((p) => p.category === cat);
    let ctp = 0, cfp = 0, cfn = 0, ctn = 0;
    for (const p of catPreds) {
      if (p.expected && p.predicted) ctp++;
      else if (!p.expected && p.predicted) cfp++;
      else if (p.expected && !p.predicted) cfn++;
      else ctn++;
    }
    const cPrecision = ctp + cfp > 0 ? ctp / (ctp + cfp) : 0;
    const cRecall = ctp + cfn > 0 ? ctp / (ctp + cfn) : 0;
    per_category[cat] = {
      accuracy: catPreds.length > 0 ? (ctp + ctn) / catPreds.length : 0,
      precision: cPrecision,
      recall: cRecall,
      f1: cPrecision + cRecall > 0 ? (2 * cPrecision * cRecall) / (cPrecision + cRecall) : 0,
      count: catPreds.length,
    };
  }

  return {
    accuracy, precision, recall, f1, auc,
    tp, fp, fn, tn, fpr, fnr,
    total: preds.length,
    avg_latency_ms, p95_latency_ms,
    total_cost_usd: totalCost,
    per_category,
  };
}

function computeSourceMetrics(preds: Prediction[]): SourceMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
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
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    accuracy: preds.length > 0 ? (tp + tn) / preds.length : 0,
  };
}

function computeStageSummary(preds: Prediction[]): Record<string, StageSummaryEntry> {
  const summary: Record<string, StageSummaryEntry> = {};
  for (const p of preds) {
    if (!p.expected) continue;
    for (const stage of p.stages_expected) {
      if (!summary[stage]) summary[stage] = { expected: 0, detected: 0 };
      summary[stage].expected++;
      if (p.predicted && p.stages_predicted.includes(stage)) {
        summary[stage].detected++;
      }
    }
  }
  return summary;
}

export interface RecomputedRun {
  predictions: Prediction[];
  metrics: MetricsResult;
  stage_summary?: Record<string, StageSummaryEntry>;
  source_breakdown?: BenchmarkRun["source_breakdown"];
}

/**
 * Apply expected-label overrides to a run's predictions and recompute all metrics.
 * `overrides` maps test_id → new expected value (only for cases the user has edited).
 */
export function recomputeRun(
  run: BenchmarkRun,
  overrides: Record<string, boolean>
): RecomputedRun {
  const predictions = run.predictions.map((p) =>
    p.test_id in overrides ? { ...p, expected: overrides[p.test_id] } : p
  );

  const metrics = computeMetricsFromPredictions(predictions);

  const stage_summary = run.stage_summary !== undefined
    ? computeStageSummary(predictions)
    : undefined;

  let source_breakdown: BenchmarkRun["source_breakdown"];
  if (run.source_breakdown !== undefined) {
    const realPreds = predictions.filter((p) => p.source === "real");
    const syntheticPreds = predictions.filter((p) => p.source !== "real");
    source_breakdown = {
      real: computeSourceMetrics(realPreds),
      synthetic: computeSourceMetrics(syntheticPreds),
    };
  }

  return { predictions, metrics, stage_summary, source_breakdown };
}
