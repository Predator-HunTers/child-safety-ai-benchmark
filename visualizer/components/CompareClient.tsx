"use client";

import { useState, useMemo } from "react";
import type { BenchmarkRun } from "@/lib/types";
import { RadarChart } from "./RadarChart";
import { CostLatencyScatter } from "./CostLatencyScatter";

export function CompareClient({
  runs,
  suites,
}: {
  runs: BenchmarkRun[];
  suites: string[];
}) {
  const [selectedSuite, setSelectedSuite] = useState("All Suites");

  const compareRuns = useMemo(() => {
    if (selectedSuite === "All Suites") {
      // Cross-suite averages: one entry per model, averaging metrics across suites
      const bestPerModelSuite = new Map<string, BenchmarkRun>();
      for (const run of runs) {
        const key = `${run.model}::${run.suite}`;
        const existing = bestPerModelSuite.get(key);
        if (!existing || run.metrics.f1 > existing.metrics.f1) {
          bestPerModelSuite.set(key, run);
        }
      }

      // Group by model and average
      const modelRuns = new Map<string, BenchmarkRun[]>();
      for (const run of bestPerModelSuite.values()) {
        const arr = modelRuns.get(run.model) ?? [];
        arr.push(run);
        modelRuns.set(run.model, arr);
      }

      return [...modelRuns.entries()].map(([model, modelRunList]) => {
        const avg = (fn: (r: BenchmarkRun) => number) =>
          modelRunList.reduce((s, r) => s + fn(r), 0) / modelRunList.length;

        // Merge per_category from all runs
        const mergedCategories: Record<
          string,
          { f1: number; precision: number; recall: number; accuracy: number; count: number }
        > = {};
        for (const r of modelRunList) {
          for (const [cat, m] of Object.entries(r.metrics.per_category)) {
            if (!mergedCategories[cat]) {
              mergedCategories[cat] = { ...m };
            }
          }
        }

        // Use first run as template, override metrics
        const template = modelRunList[0];
        return {
          ...template,
          suite: modelRunList.map((r) => r.suite).join(", "),
          metrics: {
            ...template.metrics,
            f1: avg((r) => r.metrics.f1),
            precision: avg((r) => r.metrics.precision),
            recall: avg((r) => r.metrics.recall),
            auc: avg((r) => r.metrics.auc),
            fpr: avg((r) => r.metrics.fpr),
            avg_latency_ms: avg((r) => r.metrics.avg_latency_ms),
            total_cost_usd: modelRunList.reduce(
              (s, r) => s + r.metrics.total_cost_usd,
              0
            ),
            per_category: mergedCategories,
          },
        } as BenchmarkRun;
      });
    }

    // Filter to specific suite, best per model
    const bestPerModel = new Map<string, BenchmarkRun>();
    for (const run of runs) {
      if (run.suite !== selectedSuite) continue;
      const existing = bestPerModel.get(run.model);
      if (!existing || run.metrics.f1 > existing.metrics.f1) {
        bestPerModel.set(run.model, run);
      }
    }
    return [...bestPerModel.values()];
  }, [runs, selectedSuite]);

  // Radar chart data
  const allCategories = new Set<string>();
  for (const run of compareRuns) {
    for (const cat of Object.keys(run.metrics.per_category)) {
      allCategories.add(cat);
    }
  }
  const categories = [...allCategories];

  const radarData = categories.map((cat) => {
    const entry: Record<string, string | number> = { category: cat };
    for (const run of compareRuns) {
      entry[run.model] = run.metrics.per_category[cat]?.f1 ?? 0;
    }
    return entry;
  });

  // Scatter data
  const scatterData = compareRuns.map((run) => ({
    model: run.model,
    avg_latency_ms: run.metrics.avg_latency_ms,
    total_cost_usd: run.metrics.total_cost_usd,
    f1: run.metrics.f1,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Model Comparison</h2>
        <select
          value={selectedSuite}
          onChange={(e) => setSelectedSuite(e.target.value)}
          className="rounded-md border bg-card px-3 py-2 text-sm"
        >
          <option value="All Suites">All Suites</option>
          {suites.sort().map((suite) => (
            <option key={suite} value={suite}>
              {suite}
            </option>
          ))}
        </select>
      </div>

      {compareRuns.length < 2 ? (
        <div className="py-10 text-center text-muted-foreground">
          Not enough models in this suite to compare. Select a different suite
          or run more benchmarks.
        </div>
      ) : (
        <>
          {/* Side-by-side metrics */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Model</th>
                  {selectedSuite === "All Suites" && (
                    <th className="px-4 py-2 text-left">Suites</th>
                  )}
                  <th className="px-4 py-2 text-right">Overall Score</th>
                  <th className="px-4 py-2 text-right">Correct Alerts</th>
                  <th className="px-4 py-2 text-right">Threats Caught</th>
                  <th className="px-4 py-2 text-right">Confidence</th>
                  <th className="px-4 py-2 text-right">False Alarm Rate</th>
                  <th className="px-4 py-2 text-right">Latency</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {compareRuns
                  .sort((a, b) => b.metrics.f1 - a.metrics.f1)
                  .map((run, i) => (
                    <tr
                      key={run.model}
                      className={i === 0 ? "bg-primary/5 font-medium" : ""}
                    >
                      <td className="px-4 py-2">{run.model}</td>
                      {selectedSuite === "All Suites" && (
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {run.suite.split(", ").map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-muted px-2 py-0.5 text-xs"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">
                        {(run.metrics.f1 * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(run.metrics.precision * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(run.metrics.recall * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        {run.metrics.auc.toFixed(3)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(run.metrics.fpr * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right">
                        {run.metrics.avg_latency_ms.toFixed(0)}ms
                      </td>
                      <td className="px-4 py-2 text-right">
                        {run.metrics.total_cost_usd > 0
                          ? `$${run.metrics.total_cost_usd.toFixed(4)}`
                          : "\u2014"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 font-semibold">Category Score Comparison</h3>
              <RadarChart
                data={radarData}
                models={compareRuns.map((r) => r.model)}
              />
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 font-semibold">Cost vs Latency</h3>
              <CostLatencyScatter data={scatterData} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
