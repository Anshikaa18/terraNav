"""High-level serving interface for batch inference and live observation consumption."""
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import json
import time
import pandas as pd
import numpy as np

from terranav.config import (
    ARTIFACTS_DIR,
    CHUNKFLOW_CLEAN_FEATURES,
    MIN_SPEED_FLOOR_KMH,
)
from terranav.models.prediction import TrafficPredictor


class ServingPredictorService:
    """
    Production serving predictor designed for high throughput, sub-20ms batch inference,
    and consumption of live traffic sensor feeds.
    """

    def __init__(self, model_bundle_path: Optional[Union[str, Path]] = None):
        if model_bundle_path is not None:
            bundle_p = Path(model_bundle_path)
        else:
            # Default to production segment speed model in artifacts
            bundle_p = ARTIFACTS_DIR / "production_segment_speed_model.joblib"

        self.bundle_path = bundle_p
        self.predictor = TrafficPredictor(bundle_p) if bundle_p.exists() else None
        self.call_count = 0
        self.total_latency_sec = 0.0

    def predict_segments(self, segments_payload: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process a batch of road segment observation payloads.

        Args:
            segments_payload: List of segment dictionaries containing lengthMeters and features.

        Returns:
            Dictionary with predictions, status, and processing latency.
        """
        if self.predictor is None:
            return {
                "ok": False,
                "error": "Model bundle is not loaded or missing in artifacts directory.",
                "predictions": [],
            }

        if not isinstance(segments_payload, list) or not segments_payload:
            return {"ok": False, "error": "At least one feature-complete segment is required.", "predictions": []}
        expected = set(self.predictor.feature_columns)
        for index, segment in enumerate(segments_payload):
            if not isinstance(segment, dict):
                return {"ok": False, "error": f"Segment {index} must be an object.", "predictions": []}
            length = segment.get("length_meters", segment.get("lengthMeters"))
            if length is None:
                return {"ok": False, "error": f"Segment {index} is missing its measured length in meters.", "predictions": []}
            try:
                if not np.isfinite(float(length)) or float(length) <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                return {"ok": False, "error": f"Segment {index} has an invalid measured length.", "predictions": []}
            missing = [key for key in expected if key not in segment or segment[key] is None]
            if missing:
                return {"ok": False, "error": f"Segment {index} is missing trained feature columns: {', '.join(sorted(missing))}.", "predictions": []}
            try:
                if any(not np.isfinite(float(segment[key])) for key in expected):
                    raise ValueError
            except (TypeError, ValueError):
                return {"ok": False, "error": f"Segment {index} contains a non-numeric trained feature.", "predictions": []}
            if not isinstance(segment.get("is_closed", segment.get("roadClosure", False)), bool):
                return {"ok": False, "error": f"Segment {index} has an invalid closure flag.", "predictions": []}

        start_time = time.perf_counter()
        df = pd.DataFrame(segments_payload)
        lengths = [float(s.get("length_meters", s.get("lengthMeters"))) for s in segments_payload]
        closures = [bool(s.get("is_closed", s.get("roadClosure", False))) for s in segments_payload]

        predictions = self.predictor.predict_travel_times(lengths, df, closures)
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        self.call_count += 1
        self.total_latency_sec += (duration_ms / 1000.0)

        return {
            "ok": True,
            "predictions_count": len(predictions),
            "latency_ms": round(duration_ms, 2),
            "model_schema_version": self.predictor.schema_version,
            "model_status": "research_only_synthetic_target" if "synthetic" in self.predictor.target_name.lower() else "unverified_training_provenance",
            "is_live_traffic_model": False,
            "target_name": self.predictor.target_name,
            "predictions": predictions,
        }
