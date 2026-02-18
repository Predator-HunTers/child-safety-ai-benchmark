/** Load benchmark results from the output directory. */

import { readdir, readFile } from "fs/promises";
import { resolve } from "path";
import type { BenchmarkRun } from "./types";

const OUTPUT_DIR = resolve(process.cwd(), "../output");

export async function loadAllRuns(): Promise<BenchmarkRun[]> {
  try {
    const files = await readdir(OUTPUT_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json") && f !== ".gitkeep");

    const runs: BenchmarkRun[] = [];
    for (const file of jsonFiles) {
      const content = await readFile(resolve(OUTPUT_DIR, file), "utf-8");
      runs.push(JSON.parse(content));
    }

    // Sort by timestamp descending (newest first)
    runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return runs;
  } catch {
    return [];
  }
}

export async function loadRun(runId: string): Promise<BenchmarkRun | null> {
  const runs = await loadAllRuns();
  return runs.find((r) => r.id === runId) ?? null;
}
