#!/usr/bin/env bun
/** Copy benchmark results into public/data/ for static hosting. */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { resolve, join } from "path";

const OUTPUT_DIR = resolve(import.meta.dir, "../output");
const DATA_DIR = resolve(import.meta.dir, "public/data");

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  let files: string[] = [];
  try {
    files = (await readdir(OUTPUT_DIR)).filter(
      (f) => f.endsWith(".json") && f !== ".gitkeep"
    );
  } catch {
    console.log("No output directory found, creating empty manifest.");
  }

  const manifest: Array<{ id: string; model: string; suite: string; timestamp: string }> = [];

  for (const file of files) {
    const content = await readFile(resolve(OUTPUT_DIR, file), "utf-8");
    const run = JSON.parse(content);
    manifest.push({
      id: run.id,
      model: run.model,
      suite: run.suite,
      timestamp: run.timestamp,
    });
    await writeFile(join(DATA_DIR, `${run.id}.json`), content);
  }

  await writeFile(join(DATA_DIR, "manifest.json"), JSON.stringify(manifest));
  console.log(`Prebuild: copied ${files.length} result files to public/data/`);
}

main();
