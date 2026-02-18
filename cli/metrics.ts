/** Metrics computation for benchmark evaluation. */

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

interface EvalEntry {
  test_id: string;
  category: string;
  expected: boolean;
  predicted: boolean;
  score: number;
  latency_ms: number;
  cost_usd: number;
}

export function computeMetrics(entries: EvalEntry[]): MetricsResult {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const latencies: number[] = [];
  let totalCost = 0;
  const scores: Array<{ score: number; label: boolean }> = [];

  for (const e of entries) {
    if (e.expected && e.predicted) tp++;
    else if (!e.expected && e.predicted) fp++;
    else if (e.expected && !e.predicted) fn++;
    else tn++;

    latencies.push(e.latency_ms);
    totalCost += e.cost_usd;
    scores.push({ score: e.score, label: e.expected });
  }

  const accuracy = entries.length > 0 ? (tp + tn) / entries.length : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;

  // Sort latencies for percentile
  latencies.sort((a, b) => a - b);
  const avg_latency_ms =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
  const p95_idx = Math.floor(latencies.length * 0.95);
  const p95_latency_ms = latencies[p95_idx] ?? 0;

  // AUC (trapezoidal approximation)
  const auc = computeAUC(scores);

  // Per-category metrics
  const categories = [...new Set(entries.map((e) => e.category))];
  const per_category: Record<string, CategoryMetrics> = {};
  for (const cat of categories) {
    const catEntries = entries.filter((e) => e.category === cat);
    let ctp = 0, cfp = 0, cfn = 0, ctn = 0;
    for (const e of catEntries) {
      if (e.expected && e.predicted) ctp++;
      else if (!e.expected && e.predicted) cfp++;
      else if (e.expected && !e.predicted) cfn++;
      else ctn++;
    }
    const cPrecision = ctp + cfp > 0 ? ctp / (ctp + cfp) : 0;
    const cRecall = ctp + cfn > 0 ? ctp / (ctp + cfn) : 0;
    per_category[cat] = {
      accuracy: catEntries.length > 0 ? (ctp + ctn) / catEntries.length : 0,
      precision: cPrecision,
      recall: cRecall,
      f1:
        cPrecision + cRecall > 0
          ? (2 * cPrecision * cRecall) / (cPrecision + cRecall)
          : 0,
      count: catEntries.length,
    };
  }

  return {
    accuracy,
    precision,
    recall,
    f1,
    auc,
    tp,
    fp,
    fn,
    tn,
    fpr,
    fnr,
    total: entries.length,
    avg_latency_ms,
    p95_latency_ms,
    total_cost_usd: totalCost,
    per_category,
  };
}

/** Compute ROC AUC using trapezoidal rule. */
function computeAUC(
  scores: Array<{ score: number; label: boolean }>
): number {
  if (scores.length === 0) return 0;

  // Sort by descending score
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const totalPos = sorted.filter((s) => s.label).length;
  const totalNeg = sorted.length - totalPos;

  if (totalPos === 0 || totalNeg === 0) return 0;

  let tpCount = 0;
  let fpCount = 0;
  let prevTPR = 0;
  let prevFPR = 0;
  let auc = 0;

  for (const s of sorted) {
    if (s.label) tpCount++;
    else fpCount++;

    const tpr = tpCount / totalPos;
    const fpr = fpCount / totalNeg;

    // Trapezoidal rule
    auc += ((fpr - prevFPR) * (tpr + prevTPR)) / 2;
    prevTPR = tpr;
    prevFPR = fpr;
  }

  return auc;
}
