"""Run v3 DeBERTa ONNX model for benchmark prediction. Reads JSON from stdin, writes JSON to stdout."""
import json
import os
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

# Find model artifact — set MODELS_DIR env var to override
MODELS_DIR = Path(os.environ.get("MODELS_DIR", Path(__file__).resolve().parent.parent.parent / "models"))

ONNX_CANDIDATES = [
    MODELS_DIR / "grooming" / "v3_deberta" / "output" / "model.onnx",
    MODELS_DIR / "grooming" / "v3_deberta" / "model.onnx",
]

TOKENIZER_CANDIDATES = [
    MODELS_DIR / "grooming" / "v3_deberta" / "output",
    MODELS_DIR / "grooming" / "v3_deberta",
]

GROOMING_STAGES = [
    "age_probing", "trust_building", "isolation", "location_probing",
    "contact_escalation", "explicit_solicitation", "meeting_requests",
    "coercion_threats",
]

# Find ONNX model
session = None
for onnx_path in ONNX_CANDIDATES:
    if onnx_path.exists():
        session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        break

if session is None:
    print(json.dumps({"error": "ONNX model not found", "searched": [str(p) for p in ONNX_CANDIDATES]}))
    sys.exit(1)

# Find tokenizer
tokenizer = None
for tok_path in TOKENIZER_CANDIDATES:
    if (tok_path / "tokenizer_config.json").exists():
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(str(tok_path))
        break

if tokenizer is None:
    print(json.dumps({"error": "tokenizer not found", "searched": [str(p) for p in TOKENIZER_CANDIDATES]}))
    sys.exit(1)

# Read input
data = json.loads(sys.stdin.readline())
text = data["text"]

# Tokenize
encoding = tokenizer(
    text, max_length=256, padding="max_length", truncation=True, return_tensors="np"
)

# Run inference
input_ids = encoding["input_ids"].astype(np.int64)
attention_mask = encoding["attention_mask"].astype(np.int64)
outputs = session.run(None, {"input_ids": input_ids, "attention_mask": attention_mask})

# Parse outputs: [grooming_logit, stage_logits, severity]
grooming_logit = float(outputs[0][0])
grooming_score = 1.0 / (1.0 + np.exp(-grooming_logit))  # sigmoid
label = int(grooming_score >= 0.5)

stages = []
severity = 0.0

if len(outputs) > 1:
    stage_logits = outputs[1][0]
    stage_probs = 1.0 / (1.0 + np.exp(-stage_logits))
    stages = [GROOMING_STAGES[i] for i in range(len(GROOMING_STAGES)) if stage_probs[i] >= 0.5]

if len(outputs) > 2:
    severity = float(outputs[2][0])
    severity = max(0.0, min(1.0, severity))

result = {
    "label": label,
    "score": round(grooming_score, 4),
    "stages": stages,
    "severity": round(severity, 4),
}
print(json.dumps(result))
