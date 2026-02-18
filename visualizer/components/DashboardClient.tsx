"use client";

import { useState } from "react";
import type { BenchmarkRun } from "@/lib/types";
import { SuiteTabs } from "./SuiteTabs";
import { SuiteOverviewTable } from "./SuiteOverviewTable";
import { Leaderboard } from "./Leaderboard";
import { MetricsCard } from "./MetricsCard";

export function DashboardClient({
  runs,
  allRuns,
  suites,
}: {
  runs: BenchmarkRun[];
  allRuns: BenchmarkRun[];
  suites: string[];
}) {
  const [activeTab, setActiveTab] = useState("Overview");

  if (activeTab === "Overview") {
    return (
      <OverviewTab
        runs={runs}
        allRuns={allRuns}
        suites={suites}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  }

  return (
    <SuiteTab
      suite={activeTab}
      runs={runs}
      allRuns={allRuns}
      suites={suites}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}

function OverviewTab({
  runs,
  allRuns,
  suites,
  activeTab,
  onTabChange,
}: {
  runs: BenchmarkRun[];
  allRuns: BenchmarkRun[];
  suites: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const uniqueModels = new Set(runs.map((r) => r.model));

  // Find best model by cross-suite average F1
  const modelAvgF1 = new Map<string, number>();
  for (const model of uniqueModels) {
    const modelRuns = runs.filter((r) => r.model === model);
    const avg =
      modelRuns.reduce((sum, r) => sum + r.metrics.f1, 0) / modelRuns.length;
    modelAvgF1.set(model, avg);
  }
  const bestModel = [...modelAvgF1.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-8">
      <SuiteTabs
        suites={suites}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total Runs"
          value={allRuns.length.toString()}
          subtitle="benchmark evaluations"
        />
        <MetricsCard
          title="Suites Tested"
          value={suites.length.toString()}
          subtitle={suites.join(", ")}
        />
        <MetricsCard
          title="Models Tested"
          value={uniqueModels.size.toString()}
          subtitle="unique models"
        />
        <MetricsCard
          title="Best Model (Avg F1)"
          value={bestModel ? `${(bestModel[1] * 100).toFixed(1)}%` : "---"}
          subtitle={bestModel?.[0] ?? "---"}
        />
      </div>

      {/* Cross-Suite Rankings */}
      <SuiteOverviewTable runs={allRuns} suites={suites} />

      {/* Suite Summary Cards */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Suite Summaries</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suites.sort().map((suite) => {
            const suiteRuns = runs.filter((r) => r.suite === suite);
            const models = new Set(suiteRuns.map((r) => r.model));
            const topRun = suiteRuns.sort(
              (a, b) => b.metrics.f1 - a.metrics.f1
            )[0];
            return (
              <button
                key={suite}
                onClick={() => onTabChange(suite)}
                className="rounded-lg border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <h4 className="text-base font-semibold">{suite}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {models.size} model{models.size !== 1 ? "s" : ""} tested
                </p>
                {topRun && (
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Top: {topRun.model}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {(topRun.metrics.f1 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SuiteTab({
  suite,
  runs,
  allRuns,
  suites,
  activeTab,
  onTabChange,
}: {
  suite: string;
  runs: BenchmarkRun[];
  allRuns: BenchmarkRun[];
  suites: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const suiteRuns = runs.filter((r) => r.suite === suite);
  const suiteAllRuns = allRuns.filter((r) => r.suite === suite);
  const models = new Set(suiteRuns.map((r) => r.model));
  const topRun = suiteRuns.sort((a, b) => b.metrics.f1 - a.metrics.f1)[0];

  // Count total test cases from the latest run
  const testsInSuite = topRun?.metrics.total ?? 0;

  return (
    <div className="space-y-8">
      <SuiteTabs
        suites={suites}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* Suite summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Tests in Suite"
          value={testsInSuite.toString()}
          subtitle="test cases"
        />
        <MetricsCard
          title="Models Tested"
          value={models.size.toString()}
          subtitle="on this suite"
        />
        <MetricsCard
          title="Best F1"
          value={topRun ? `${(topRun.metrics.f1 * 100).toFixed(1)}%` : "---"}
          subtitle="highest overall score"
        />
        <MetricsCard
          title="Best Model"
          value={topRun?.model ?? "---"}
          subtitle={
            topRun
              ? `${suiteAllRuns.filter((r) => r.model === topRun.model).length} run(s)`
              : ""
          }
        />
      </div>

      {/* Per-suite leaderboard */}
      <Leaderboard runs={suiteRuns} suiteFilter={suite} />
    </div>
  );
}
