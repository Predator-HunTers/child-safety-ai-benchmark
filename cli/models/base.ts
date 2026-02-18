/** Base model adapter interface for benchmark evaluation. */

export interface ModelPrediction {
  is_grooming: boolean;
  stages: string[];
  severity: number;
  explanation?: string;
  raw_score?: number;
}

export interface ModelResult {
  prediction: ModelPrediction;
  latency_ms: number;
  cost_usd?: number;
  tokens_used?: number;
}

export interface TestCase {
  id: string;
  category: string;
  source?: "real" | "synthetic";
  case_id?: string;
  chunk?: string;
  messages?: Array<{ role: string; text: string }>;
  input?: { type: string; content: string };
  expected: Record<string, unknown>;
}

export interface TestSuite {
  suite: string;
  version: string;
  description: string;
  tests: TestCase[];
}

export abstract class BaseModel {
  abstract readonly name: string;
  abstract readonly provider: string;

  /** Run a single test case through the model. */
  abstract predict(test: TestCase): Promise<ModelResult>;

  /** Format messages into a single text string for models that need it. */
  protected formatMessages(
    messages: Array<{ role: string; text: string }>
  ): string {
    return messages
      .map(
        (m) =>
          `${m.role === "other" ? "Adult" : "Child"}: ${m.text}`
      )
      .join("\n");
  }
}
