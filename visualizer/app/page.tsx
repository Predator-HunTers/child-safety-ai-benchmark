import { loadAllRuns } from "@/lib/load-results";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const runs = await loadAllRuns();

  if (runs.length === 0) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          No benchmark results yet
        </h2>
        <p className="mt-2 text-muted-foreground">
          Run a benchmark first:
        </p>
        <pre className="mt-4 inline-block rounded-lg bg-muted px-4 py-2 text-sm">
          bun run cli/index.ts --suite grooming --model safeview-server
        </pre>
      </div>
    );
  }

  // Deduplicate: best run per model+suite
  const bestPerModelSuite = new Map<string, (typeof runs)[0]>();
  for (const run of runs) {
    const key = `${run.model}::${run.suite}`;
    const existing = bestPerModelSuite.get(key);
    if (!existing || run.metrics.f1 > existing.metrics.f1) {
      bestPerModelSuite.set(key, run);
    }
  }
  const leaderboardRuns = [...bestPerModelSuite.values()].sort(
    (a, b) => b.metrics.f1 - a.metrics.f1
  );

  // Discover suites
  const suites = [...new Set(runs.map((r) => r.suite))];

  return (
    <DashboardClient
      runs={leaderboardRuns}
      allRuns={runs}
      suites={suites}
    />
  );
}
