"use client";

import type { BenchmarkRun } from "@/lib/types";
import { useState } from "react";

interface ModelSuiteStats {
  model: string;
  suitesRun: number;
  avgF1: number;
  avgPrecision: number;
  avgRecall: number;
  perSuite: Record<string, number>; // suite -> best F1
}

function f1Badge(f1: number) {
  const pct = f1 * 100;
  const color =
    pct >= 90
      ? "bg-green-100 text-green-800"
      : pct >= 75
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-mono font-medium ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

type SortKey = "avgF1" | "avgPrecision" | "avgRecall" | "suitesRun" | string;

export function SuiteOverviewTable({
  runs,
  suites,
}: {
  runs: BenchmarkRun[];
  suites: string[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("avgF1");
  const [ascending, setAscending] = useState(false);

  // Build best F1 per model+suite
  const bestPerModelSuite = new Map<string, BenchmarkRun>();
  for (const run of runs) {
    const key = `${run.model}::${run.suite}`;
    const existing = bestPerModelSuite.get(key);
    if (!existing || run.metrics.f1 > existing.metrics.f1) {
      bestPerModelSuite.set(key, run);
    }
  }

  // Aggregate per model
  const modelMap = new Map<string, ModelSuiteStats>();
  for (const [key, run] of bestPerModelSuite) {
    const model = run.model;
    if (!modelMap.has(model)) {
      modelMap.set(model, {
        model,
        suitesRun: 0,
        avgF1: 0,
        avgPrecision: 0,
        avgRecall: 0,
        perSuite: {},
      });
    }
    const stats = modelMap.get(model)!;
    stats.perSuite[run.suite] = run.metrics.f1;
  }

  // Compute averages
  for (const stats of modelMap.values()) {
    const suiteF1s = Object.values(stats.perSuite);
    stats.suitesRun = suiteF1s.length;
    stats.avgF1 = suiteF1s.reduce((a, b) => a + b, 0) / suiteF1s.length;

    // Get avg precision/recall from best runs
    let totalP = 0,
      totalR = 0,
      count = 0;
    for (const suite of Object.keys(stats.perSuite)) {
      const run = bestPerModelSuite.get(`${stats.model}::${suite}`);
      if (run) {
        totalP += run.metrics.precision;
        totalR += run.metrics.recall;
        count++;
      }
    }
    stats.avgPrecision = count > 0 ? totalP / count : 0;
    stats.avgRecall = count > 0 ? totalR / count : 0;
  }

  const rows = [...modelMap.values()];

  // Sort
  rows.sort((a, b) => {
    let aVal: number, bVal: number;
    if (sortBy === "avgF1") {
      aVal = a.avgF1;
      bVal = b.avgF1;
    } else if (sortBy === "avgPrecision") {
      aVal = a.avgPrecision;
      bVal = b.avgPrecision;
    } else if (sortBy === "avgRecall") {
      aVal = a.avgRecall;
      bVal = b.avgRecall;
    } else if (sortBy === "suitesRun") {
      aVal = a.suitesRun;
      bVal = b.suitesRun;
    } else {
      // Sort by specific suite F1
      aVal = a.perSuite[sortBy] ?? -1;
      bVal = b.perSuite[sortBy] ?? -1;
    }
    return ascending ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setAscending(!ascending);
    else {
      setSortBy(key);
      setAscending(false);
    }
  };

  const SortHeader = ({
    label,
    field,
    align = "right",
  }: {
    label: string;
    field: SortKey;
    align?: "left" | "right";
  }) => (
    <th
      className={`cursor-pointer whitespace-nowrap px-3 py-3 hover:text-primary ${
        align === "left" ? "text-left" : "text-right"
      }`}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortBy === field && (ascending ? " \u25B2" : " \u25BC")}
    </th>
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Cross-Suite Rankings</h2>
        <p className="text-sm text-muted-foreground">
          Average performance across all suites each model was evaluated on
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left">#</th>
              <SortHeader label="Model" field="avgF1" align="left" />
              <SortHeader label="Suites" field="suitesRun" />
              <SortHeader label="Avg F1" field="avgF1" />
              <SortHeader label="Avg Precision" field="avgPrecision" />
              <SortHeader label="Avg Recall" field="avgRecall" />
              {suites.sort().map((suite) => (
                <SortHeader key={suite} label={suite} field={suite} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.model}
                className={`border-b transition-colors hover:bg-muted/50 ${
                  i === 0 ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-3 py-3 font-mono text-muted-foreground">
                  {i + 1}
                </td>
                <td className="px-3 py-3 font-medium">{row.model}</td>
                <td className="px-3 py-3 text-right font-mono">
                  {row.suitesRun}
                </td>
                <td className="px-3 py-3 text-right font-mono font-medium">
                  {(row.avgF1 * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {(row.avgPrecision * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {(row.avgRecall * 100).toFixed(1)}%
                </td>
                {suites.sort().map((suite) => (
                  <td key={suite} className="px-3 py-3 text-right">
                    {row.perSuite[suite] != null ? (
                      f1Badge(row.perSuite[suite])
                    ) : (
                      <span className="text-xs text-muted-foreground">---</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
