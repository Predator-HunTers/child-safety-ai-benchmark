# Predator Hunters — Child Safety AI Benchmark

Benchmark platform for evaluating how well AI models detect child safety threats.
Measures accuracy, explainability, latency, and cost across multiple test suites.

Built by the Predator Hunters not-for-profit for child safety research.

## Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| `grooming` | 233 | Multi-stage grooming detection (8 stages + safe conversations + false positive corpus) |
| `grooming-real` | 12 | Full anonymized chat logs from 10 convicted predators (sequential chunks) |
| `stranger-meeting` | 50 | Adults soliciting in-person meetings with minors |
| `nsfw` | 10 | Explicit/NSFW content identification |
| `health-risk` | 10 | Eating disorders, self-harm, suicide ideation detection |

## Quick Start

```bash
# Install dependencies
bun install

# List available models and suites
bun run bench --list

# Run grooming benchmark against an LLM via OpenRouter
export OPENROUTER_API_KEY=sk-or-v1-...
bun run bench --suite grooming --model openrouter:claude-opus-4.6

# Run real case benchmark (default: 1 case for quick testing)
bun run bench --suite grooming-real --model openrouter:gpt-5

# Run with more real cases
bun run bench --suite grooming-real --model openrouter:gpt-5 -r 5

# Run all 10 real cases
bun run bench --suite grooming-real --model openrouter:gpt-5 -r 10

# Run against local SafeView Shield server
bun run bench --suite grooming --model safeview-server

# View results dashboard
cd visualizer && bun install && bun run dev
# Open http://localhost:3000
```

## CLI Options

```
-s, --suite <name>        Test suite (comma-separated for multiple)
-m, --model <name>        Model to evaluate (see --list)
-c, --concurrency <n>     Concurrent requests (default: 5)
-r, --real-case-count <n> Limit real-case suites to first N cases (default: 1)
-v, --verbose             Show detailed progress
-l, --list                List available models and suites
-h, --help                Show this help
```

## Available Models

### Local Models
- `v1-sklearn` — TF-IDF + LogisticRegression (via Python bridge)
- `v3-deberta-onnx` — DeBERTa-v3-small ONNX (via Python bridge)
- `safeview-server` — SafeView Shield FastAPI server

### LLMs via OpenRouter
- `openrouter:claude-opus-4.6`
- `openrouter:gpt-5.2-pro`
- `openrouter:grok-4.1`
- `openrouter:gemini-3-pro`
- `openrouter:deepseek-v3.2`
- `openrouter:qwen-3.5`

And more — see `bun run bench --list` for the full list.

## What Gets Measured

- **Accuracy, Precision, Recall, F1** — standard classification metrics
- **AUC** — area under ROC curve
- **FPR / FNR** — false positive/negative rates
- **Per-category breakdown** — performance on each grooming stage
- **Stage detection** — which grooming stages the model identifies
- **Latency** — average and p95 response time
- **Cost** — total API cost for OpenRouter models
- **Explanations** — why the model classified each case (LLMs only)
- **Real vs Synthetic** — separate scores for real chat logs vs synthetic tests

## Architecture

```
child-safety-benchmark/
├── cli/                # TypeScript CLI runner (Bun)
│   ├── index.ts        # Entry point with --real-case-count support
│   ├── runner.ts       # Concurrent evaluation orchestrator
│   ├── metrics.ts      # Metric computation (F1, AUC, per-category)
│   ├── report.ts       # JSON report generation
│   ├── generate-real-cases.ts  # Anonymize real chat logs into test cases
│   └── models/         # Model adapters (OpenRouter, local sklearn/ONNX, SafeView)
├── suites/             # Test case definitions (JSON)
│   ├── grooming.json
│   ├── grooming-real.json
│   ├── stranger-meeting.json
│   ├── nsfw.json
│   └── health-risk.json
├── python/             # Python bridge for local sklearn/ONNX inference
├── visualizer/         # Next.js 15 dashboard
│   ├── app/            # Pages (leaderboard with suite tabs, run detail, compare)
│   └── components/     # Recharts visualizations, suite overview table
├── output/             # Generated result JSONs (gitignored)
└── data/               # Raw data for regenerating real cases (not included)
```

## Dashboard Features

- **Suite Tabs** — per-suite leaderboards with Overview cross-suite ranking
- **Cross-Suite Rankings** — average performance across all suites per model
- **Suite Summary Cards** — quick overview of each suite's top model
- **Run Detail** — per-test results with explanations
- **Confusion Matrix** — interactive TP/FP/FN/TN visualization
- **Category F1 Chart** — performance across grooming stages
- **Radar Chart** — multi-model category comparison
- **Cost vs Latency** — scatter plot for efficiency comparison
- **Suite Filter on Compare** — compare models within a specific suite

## Generating Real Cases

The `grooming-real` suite is pre-generated from anonymized convicted predator chat logs.
To regenerate from raw data:

```bash
# Set path to raw JSONL data
export RAW_DATA_PATH=/path/to/full_scraped_cases_v2.jsonl

# Generate
bun run generate-real
```

## Python Bridge Setup

For local model evaluation (`v1-sklearn`, `v3-deberta-onnx`):

```bash
pip install -r python/requirements.txt

# Point to your model artifacts
export MODELS_DIR=/path/to/models
```

## License

MIT
