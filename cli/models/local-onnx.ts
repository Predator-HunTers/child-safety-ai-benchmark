/** Local ONNX (v3 DeBERTa) model adapter — shells out to Python for inference. */

import { BaseModel, type ModelResult, type TestCase } from "./base.js";
import { resolve } from "path";

export class LocalOnnxModel extends BaseModel {
  readonly name = "v3-deberta-onnx";
  readonly provider = "local";
  private pythonScript: string;

  constructor() {
    super();
    this.pythonScript = resolve(
      import.meta.dir,
      "../../python/run_onnx.py"
    );
  }

  async predict(test: TestCase): Promise<ModelResult> {
    const text = test.messages
      ? this.formatMessages(test.messages)
      : test.input?.content ?? "";

    const start = performance.now();

    const proc = Bun.spawn(["python", this.pythonScript], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const input = JSON.stringify({ text }) + "\n";
    proc.stdin.write(input);
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    const latency_ms = performance.now() - start;

    if (proc.exitCode !== 0) {
      throw new Error(`ONNX predict failed: ${stderr}`);
    }

    const result = JSON.parse(output.trim());

    return {
      prediction: {
        is_grooming: result.label === 1,
        stages: result.stages ?? [],
        severity: result.severity ?? result.score ?? 0,
        raw_score: result.score,
      },
      latency_ms,
    };
  }
}
