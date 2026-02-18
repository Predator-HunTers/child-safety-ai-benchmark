/** Load benchmark results from the output directory. */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { resolve, join } from "path";
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

/**
 * Write all runs as individual JSON files into public/data/ so the
 * client-side results page can fetch them at runtime on static hosting.
 */
export async function prebuildRunData(): Promise<string[]> {
  const runs = await loadAllRuns();
  const dataDir = resolve(process.cwd(), "public/data");
  await mkdir(dataDir, { recursive: true });

  // Write manifest
  const manifest = runs.map((r) => ({
    id: r.id,
    model: r.model,
    suite: r.suite,
    timestamp: r.timestamp,
  }));
  await writeFile(join(dataDir, "manifest.json"), JSON.stringify(manifest));

  // Write individual run files
  for (const run of runs) {
    await writeFile(join(dataDir, `${run.id}.json`), JSON.stringify(run));
  }

  return runs.map((r) => r.id);
}
