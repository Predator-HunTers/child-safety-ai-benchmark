"""Run v1 sklearn model for benchmark prediction. Reads JSON from stdin, writes JSON to stdout."""
import json
import os
import pickle
import sys
from pathlib import Path

# Find model artifact — set MODELS_DIR env var to override
MODELS_DIR = Path(os.environ.get("MODELS_DIR", Path(__file__).resolve().parent.parent.parent / "models"))
PKL_CANDIDATES = [
    MODELS_DIR / "grooming" / "v1_sklearn" / "grooming_model.pkl",
    MODELS_DIR / "grooming" / "v1_sklearn" / "output" / "grooming_model.pkl",
]

pipeline = None
for pkl_path in PKL_CANDIDATES:
    if pkl_path.exists():
        with open(pkl_path, "rb") as f:
            pipeline = pickle.load(f)
        break

if pipeline is None:
    print(json.dumps({"error": "sklearn model not found", "searched": [str(p) for p in PKL_CANDIDATES]}))
    sys.exit(1)

# Read input from stdin
data = json.loads(sys.stdin.readline())
text = data["text"]

# Predict
score = float(pipeline.predict_proba([text])[0, 1])
label = int(score >= 0.5)

# Output
result = {"label": label, "score": round(score, 4)}
print(json.dumps(result))
