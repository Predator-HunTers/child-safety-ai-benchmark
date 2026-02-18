"use client";

export function ConfusionMatrix({
  tp,
  fp,
  fn,
  tn,
}: {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}) {
  const total = tp + fp + fn + tn;
  const maxVal = Math.max(tp, fp, fn, tn);

  const cellColor = (val: number, isCorrect: boolean) => {
    const intensity = maxVal > 0 ? val / maxVal : 0;
    if (isCorrect) {
      return `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`;
    }
    return `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`;
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 font-semibold">Confusion Matrix</h3>
      <div className="mx-auto max-w-xs">
        <div className="mb-2 text-center text-xs text-muted-foreground">
          Predicted
        </div>
        <div className="flex items-center">
          <div className="-rotate-90 text-xs text-muted-foreground">
            Actual
          </div>
          <div className="flex-1">
            {/* Header row */}
            <div className="mb-1 grid grid-cols-3 gap-1 text-center text-xs text-muted-foreground">
              <div />
              <div>Grooming</div>
              <div>Safe</div>
            </div>
            {/* Correctly Flagged / Missed Threats row */}
            <div className="mb-1 grid grid-cols-3 gap-1">
              <div className="flex items-center justify-center text-xs text-muted-foreground">
                Grooming
              </div>
              <div
                className="rounded-md p-4 text-center"
                style={{ backgroundColor: cellColor(tp, true) }}
              >
                <div className="text-2xl font-bold">{tp}</div>
                <div className="text-xs text-muted-foreground">Correctly Flagged</div>
                <div className="text-xs">
                  {total > 0 ? ((tp / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div
                className="rounded-md p-4 text-center"
                style={{ backgroundColor: cellColor(fn, false) }}
              >
                <div className="text-2xl font-bold">{fn}</div>
                <div className="text-xs text-muted-foreground">Missed Threats</div>
                <div className="text-xs">
                  {total > 0 ? ((fn / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
            {/* False Alarms / Correctly Cleared row */}
            <div className="grid grid-cols-3 gap-1">
              <div className="flex items-center justify-center text-xs text-muted-foreground">
                Safe
              </div>
              <div
                className="rounded-md p-4 text-center"
                style={{ backgroundColor: cellColor(fp, false) }}
              >
                <div className="text-2xl font-bold">{fp}</div>
                <div className="text-xs text-muted-foreground">False Alarms</div>
                <div className="text-xs">
                  {total > 0 ? ((fp / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div
                className="rounded-md p-4 text-center"
                style={{ backgroundColor: cellColor(tn, true) }}
              >
                <div className="text-2xl font-bold">{tn}</div>
                <div className="text-xs text-muted-foreground">Correctly Cleared</div>
                <div className="text-xs">
                  {total > 0 ? ((tn / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
