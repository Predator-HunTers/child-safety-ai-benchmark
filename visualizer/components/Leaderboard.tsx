"use client";

import { type BenchmarkRun, detectFailureReason } from "@/lib/types";
import { useState } from "react";

type SortKey = "f1" | "precision" | "recall" | "auc" | "fpr" | "avg_latency_ms";

export function Leaderboard({
  runs,
  suiteFilter,
}: {
  runs: BenchmarkRun[];
  suiteFilter?: string;
}) {
  const filteredRuns = suiteFilter
    ? runs.filter((r) => r.suite === suiteFilter)
    : runs;
  const [sortBy, setSortBy] = useState<SortKey>("f1");
  const [ascending, setAscending] = useState(false);

  const sorted = [...filteredRuns].sort((a, b) => {
    const aVal = sortBy === "avg_latency_ms" || sortBy === "fpr"
      ? a.metrics[sortBy]
      : a.metrics[sortBy];
    const bVal = sortBy === "avg_latency_ms" || sortBy === "fpr"
      ? b.metrics[sortBy]
      : b.metrics[sortBy];

    // For latency and FPR, lower is better
    const lowerIsBetter = sortBy === "avg_latency_ms" || sortBy === "fpr";
    const direction = ascending !== lowerIsBetter ? 1 : -1;
    return (bVal - aVal) * direction;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setAscending(!ascending);
    else {
      setSortBy(key);
      setAscending(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="cursor-pointer px-4 py-3 text-right hover:text-primary"
      onClick={() => handleSort(field)}
    >
      {label}
      {sortBy === field && (ascending ? " \u25B2" : " \u25BC")}
    </th>
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">
          {suiteFilter ? `${suiteFilter} Leaderboard` : "Model Leaderboard"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Best run per model{suiteFilter ? ` on ${suiteFilter}` : ""}, sorted by {
            {
              f1: "overall score",
              precision: "correct alerts",
              recall: "threats caught",
              auc: "confidence",
              fpr: "false alarm rate",
              avg_latency_ms: "latency",
            }[sortBy]
          }
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Model</th>
              {!suiteFilter && <th className="px-4 py-3 text-left">Suite</th>}
              <SortHeader label="Overall Score" field="f1" />
              <SortHeader label="Correct Alerts" field="precision" />
              <SortHeader label="Threats Caught" field="recall" />
              <SortHeader label="Confidence" field="auc" />
              <SortHeader label="False Alarm Rate" field="fpr" />
              <SortHeader label="Latency" field="avg_latency_ms" />
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((run, i) => (
              <tr
                key={run.id}
                className={`border-b transition-colors hover:bg-muted/50 ${i === 0 ? "bg-primary/5" : ""}`}
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-4 py-3 font-medium">
                  {run.model}
                  {(() => {
                    const reason = detectFailureReason(run);
                    if (reason.type === "refused") {
                      return (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title={reason.description}>
                          Refused
                        </span>
                      );
                    }
                    if (reason.type === "all_errors" || reason.type === "api_error") {
                      return (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800" title={reason.description}>
                          Error
                        </span>
                      );
                    }
                    return null;
                  })()}
                </td>
                {!suiteFilter && (
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {run.suite}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-right font-mono">
                  {(run.metrics.f1 * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(run.metrics.precision * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(run.metrics.recall * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {run.metrics.auc.toFixed(3)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(run.metrics.fpr * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {run.metrics.avg_latency_ms.toFixed(0)}ms
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/results?id=${run.id}`}
                    className="text-primary hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
