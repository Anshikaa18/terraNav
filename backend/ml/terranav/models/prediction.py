"""Production inference predictor with uncertainty estimation and travel-time derivation."""
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
import joblib
import numpy as np
import pandas as pd

from terranav.config import (
    MIN_SPEED_FLOOR_KMH,
    MAX_PHYSICAL_SPEED_KMH,
    KMH_TO_MPS,
    CHUNKFLOW_CLEAN_FEATURES,
)
from terranav.data.validation import speed_to_travel_time


class TrafficPredictor:
    """
    Unified traffic condition and travel-time predictor.
    Loads trained model bundle, validates inputs, predicts speeds, derives traversal times,
    and calculates prediction uncertainty intervals.
    """

    def __init__(self, bundle_path: Union[str, Path]):
        self.bundle_path = Path(bundle_path)
        if not self.bundle_path.exists():
            raise FileNotFoundError(f"Model bundle not found at: {self.bundle_path}")

        bundle = joblib.load(self.bundle_path)
        self.model = bundle["model"]
        self.feature_columns = bundle["feature_columns"]
        self.target_name = bundle.get("target_name", "speed_kmh")
        self.metadata = bundle.get("metadata", {})
        self.schema_version = bundle.get("schema_version", "v1.0")
        if self.feature_columns != CHUNKFLOW_CLEAN_FEATURES:
            raise ValueError("Model feature schema does not match the audited clean 17-feature contract.")
        if any(column.startswith("x_LEAK_") for column in self.feature_columns):
            raise ValueError("Model bundle contains a prohibited leakage feature.")

        # Uncertainty standard error proxy (derived from validation RMSE)
        self.val_rmse = float(self.metadata.get("val_rmse", 8.0))

    def predict_speed(self, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict future speed in km/h and estimate 1-sigma uncertainty.

        Returns:
            Tuple of (predicted_speed_kmh, uncertainty_std_kmh).
        """
        # Ensure all feature columns exist, supporting both pre-encoded 'x_' columns and raw column names
        raw_aliases = {
            "x_Estimated Chunk Traffic Volume (synthetic)": ["Estimated Chunk Traffic Volume (synthetic)", "estimatedTrafficVolume", "trafficVolume"],
            "x_Estimated Queue Length (m; synthetic)": ["Estimated Queue Length (m; synthetic)", "estimatedQueueLengthMeters", "queueLength"],
            "x_Estimated Signal Delay (sec; synthetic)": ["Estimated Signal Delay (sec; synthetic)", "signalDelay"],
            "x_Estimated Incident Delay (sec; synthetic)": ["Estimated Incident Delay (sec; synthetic)", "incidentDelay"],
            "x_Estimated Roadwork Delay (sec; synthetic)": ["Estimated Roadwork Delay (sec; synthetic)", "roadworkDelay"],
            "x_Chunk Length (m)": ["Chunk Length (m)", "lengthMeters", "length_meters"],
            "x_Road Capacity Utilization": ["Road Capacity Utilization", "roadCapacityUtilization", "capacityUtilization"],
        }

        X_aligned = pd.DataFrame(index=X.index)
        for col in self.feature_columns:
            if col in X.columns:
                X_aligned[col] = pd.to_numeric(X[col], errors="coerce").fillna(0.0)
            elif col in raw_aliases and any(a in X.columns for a in raw_aliases[col]):
                for a in raw_aliases[col]:
                    if a in X.columns:
                        X_aligned[col] = pd.to_numeric(X[a], errors="coerce").fillna(0.0)
                        break
            elif col == "x_Traffic Signal Present_Yes":
                if "Traffic Signal Present" in X.columns:
                    X_aligned[col] = X["Traffic Signal Present"].astype(str).str.lower().isin(["yes", "true", "1"]).astype(float)
                elif "hasSignal" in X.columns:
                    X_aligned[col] = X["hasSignal"].astype(bool).astype(float)
                else:
                    X_aligned[col] = 0.0
            elif col == "x_Roadwork in Chunk_Yes":
                if "Roadwork in Chunk" in X.columns:
                    X_aligned[col] = X["Roadwork in Chunk"].astype(str).str.lower().isin(["yes", "true", "1"]).astype(float)
                else:
                    X_aligned[col] = 0.0
            elif col.startswith("x_Weather Conditions_"):
                weather_type = col.replace("x_Weather Conditions_", "").lower()
                if "Weather Conditions" in X.columns:
                    X_aligned[col] = (X["Weather Conditions"].astype(str).str.lower() == weather_type).astype(float)
                else:
                    X_aligned[col] = 0.0
            elif col.startswith("x_Chunk Sequence_"):
                seq_idx = col.replace("x_Chunk Sequence_", "")
                if "Chunk Sequence" in X.columns:
                    X_aligned[col] = (X["Chunk Sequence"].astype(str) == seq_idx).astype(float)
                elif "sequence" in X.columns:
                    X_aligned[col] = (X["sequence"].astype(str) == seq_idx).astype(float)
                else:
                    X_aligned[col] = 0.0
            else:
                X_aligned[col] = 0.0

        raw_preds = self.model.predict(X_aligned)
        # Clamping predictions to physical bounds
        clamped_speeds = np.clip(raw_preds, MIN_SPEED_FLOOR_KMH, MAX_PHYSICAL_SPEED_KMH)

        # Uncertainty calculation: base RMSE scaled by capacity utilization if available
        uncertainty = np.full(len(clamped_speeds), self.val_rmse, dtype=float)
        if "x_Road Capacity Utilization" in X_aligned.columns:
            cap_factor = 1.0 + 0.5 * np.maximum(0.0, X_aligned["x_Road Capacity Utilization"].to_numpy())
            uncertainty *= cap_factor

        return clamped_speeds, uncertainty

    def predict_travel_times(
        self,
        lengths_meters: List[float],
        feature_df: pd.DataFrame,
        is_closed_flags: Optional[List[bool]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Predict travel times for road segments.

        Args:
            lengths_meters: Length of each segment in meters.
            feature_df: DataFrame matching length of segments with candidate features.
            is_closed_flags: Optional boolean flags indicating road closure.

        Returns:
            List of dictionaries with predicted speed, travel time in seconds, and uncertainty.
        """
        if len(lengths_meters) != len(feature_df):
            raise ValueError("Length of lengths_meters must match number of rows in feature_df")

        speeds, uncertainties = self.predict_speed(feature_df)
        closed = is_closed_flags or [False] * len(lengths_meters)

        results = []
        for i, (length, speed, unc, is_closed) in enumerate(zip(lengths_meters, speeds, uncertainties, closed)):
            t_sec = speed_to_travel_time(
                length_meters=length,
                speed_kmh=speed,
                min_speed_floor_kmh=MIN_SPEED_FLOOR_KMH,
                is_closed=is_closed,
            )
            # Estimate upper and lower 90% travel-time confidence bounds
            speed_low = max(MIN_SPEED_FLOOR_KMH, speed - 1.645 * unc)
            speed_high = min(MAX_PHYSICAL_SPEED_KMH, speed + 1.645 * unc)

            t_high = speed_to_travel_time(length, speed_low, is_closed=is_closed)
            t_low = speed_to_travel_time(length, speed_high, is_closed=is_closed)

            results.append({
                "segment_index": i,
                "length_meters": float(length),
                "predicted_speed_kmh": float(round(speed, 2)),
                "speed_uncertainty_kmh": float(round(unc, 2)),
                "predicted_travel_time_sec": float(round(t_sec, 2)),
                "travel_time_lower_90_sec": float(round(t_low, 2)),
                "travel_time_upper_90_sec": float(round(t_high, 2)),
                "is_closed": bool(is_closed),
            })

        return results
