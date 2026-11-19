"""JSON worker used by the ChunkFlow backend for ChunkFlow inference.

Receives chunk features from stdin and outputs predictions with documented units:
- estimatedSpeedKmh: float (km/h)
- densityVehiclesPerKm: float (veh/km)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BUNDLE_PATH = ROOT / "ChunkFlow_Trained_Models_and_Preprocessing.joblib"


def process_payload(payload: dict) -> dict:
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        return {"ok": False, "error": "rows must be a non-empty array", "code": "INVALID_INPUT"}

    if not BUNDLE_PATH.exists():
        return {
            "ok": False,
            "error": "Missing ChunkFlow preprocessing bundle. Run build_bundle.py to generate artifacts.",
            "code": "MODEL_UNAVAILABLE"
        }

    import pandas as pd
    from chunkflow_pipeline import predict, BUNDLE

    df = pd.DataFrame(rows)
    prediction_frame = predict(df)

    predictions = []
    for _, row in prediction_frame.iterrows():
        speed_val = float(row.get("Estimated Chunk Speed (km/h; synthetic) — prediction", 0.0))
        density_val = float(row.get("Observed Chunk Traffic Density (veh/km) — prediction", 0.0))
        predictions.append({
            "estimatedSpeedKmh": max(5.0, min(120.0, round(speed_val, 2))),
            "densityVehiclesPerKm": max(0.0, min(300.0, round(density_val, 2))),
        })

    return {
        "ok": True,
        "modelVersion": BUNDLE.get("model_version", "ChunkFlow-v1.0-HGBR"),
        "targetCount": len(predictions),
        "predictions": predictions
    }


def run_daemon() -> None:
    # Pre-warm model bundle and sklearn pipeline
    import pandas as pd
    from chunkflow_pipeline import predict, BUNDLE
    try:
        predict(pd.DataFrame([{"Chunk Length (m)": 200, "Sequence": 1}]))
    except Exception:
        pass

    # Signal readiness once pipeline is fully warmed
    print(json.dumps({"ok": True, "ready": True, "modelVersion": BUNDLE.get("model_version", "ChunkFlow-v1.0-HGBR")}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "PING":
            print(json.dumps({"ok": True, "pong": True}), flush=True)
            continue
        req_id = None
        try:
            payload = json.loads(line)
            req_id = payload.get("id")
            result = process_payload(payload)
            if req_id is not None:
                result["id"] = req_id
            print(json.dumps(result), flush=True)
        except Exception as exc:
            err_resp = {"ok": False, "error": str(exc), "code": "MODEL_ERROR"}
            if req_id is not None:
                err_resp["id"] = req_id
            print(json.dumps(err_resp), flush=True)


def main() -> None:
    if "--daemon" in sys.argv:
        run_daemon()
        return

    try:
        raw_input = sys.stdin.read()
        if not raw_input or not raw_input.strip():
            raise ValueError("Empty input received")
        
        try:
            payload = json.loads(raw_input)
        except json.JSONDecodeError as exc:
            print(json.dumps({"ok": False, "error": f"Invalid JSON payload: {exc}", "code": "INVALID_INPUT"}), flush=True)
            return

        result = process_payload(payload)
        print(json.dumps(result), flush=True)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc), "code": "MODEL_ERROR"}), flush=True)


if __name__ == "__main__":
    main()

