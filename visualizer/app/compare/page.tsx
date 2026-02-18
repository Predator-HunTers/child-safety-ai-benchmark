import { loadAllRuns } from "@/lib/load-results";
import { CompareClient } from "@/components/CompareClient";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const runs = await loadAllRuns();

  if (runs.length < 2) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-semibold">Not enough data to compare</h2>
        <p className="mt-2 text-muted-foreground">
          Run at least 2 benchmarks with different models to see comparisons.
        </p>
      </div>
    );
  }

  const suites = [...new Set(runs.map((r) => r.suite))];

  return <CompareClient runs={runs} suites={suites} />;
}
