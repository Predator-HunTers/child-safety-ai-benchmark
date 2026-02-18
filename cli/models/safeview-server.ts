/** SafeView Shield server adapter — calls the FastAPI /scan/text endpoint. */

import { BaseModel, type ModelResult, type TestCase } from "./base.js";

export class SafeViewServerModel extends BaseModel {
  readonly name = "safeview-server";
  readonly provider = "safeview";
  private baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl =
      baseUrl ??
      process.env.SAFEVIEW_SERVER_URL ??
      "http://localhost:8000";
  }

  async predict(test: TestCase): Promise<ModelResult> {
    const text = test.messages
      ? this.formatMessages(test.messages)
      : test.input?.content ?? "";

    const start = performance.now();

    const response = await fetch(`${this.baseUrl}/scan/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const latency_ms = performance.now() - start;

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `SafeView server error (${response.status}): ${err}`
      );
    }

    const data = await response.json();

    return {
      prediction: {
        is_grooming: Boolean(data.is_grooming ?? data.label === 1),
        stages: data.stages ?? [],
        severity: data.severity ?? data.score ?? 0,
        raw_score: data.score,
      },
      latency_ms,
    };
  }
}
