"""Monitoring metrics, data freshness tracking, and feature drift detection."""
from typing import Dict, List, Optional, Any
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp


def detect_feature_drift(
    reference_data: pd.DataFrame,
    current_data: pd.DataFrame,
    feature_columns: List[str],
    p_value_threshold: float = 0.05,
) -> Dict[str, Any]:
    """
    Detect statistical distribution drift between reference training features
    and live serving observations using the two-sample Kolmogorov-Smirnov test.
    """
    drift_results = {}
    drifted_features = []

    for col in feature_columns:
        if col not in reference_data.columns or col not in current_data.columns:
            continue
        ref_vals = pd.to_numeric(reference_data[col], errors="coerce").dropna().to_numpy()
        cur_vals = pd.to_numeric(current_data[col], errors="coerce").dropna().to_numpy()

        if len(ref_vals) < 20 or len(cur_vals) < 20:
            continue

        ks_stat, p_val = ks_2samp(ref_vals, cur_vals)
        has_drift = p_val < p_value_threshold

        drift_results[col] = {
            "ks_statistic": round(float(ks_stat), 4),
            "p_value": round(float(p_val), 5),
            "drift_detected": bool(has_drift),
        }
        if has_drift:
            drifted_features.append(col)

    return {
        "total_features_checked": len(drift_results),
        "drifted_features_count": len(drifted_features),
        "drifted_features": drifted_features,
        "feature_details": drift_results,
    }


def compute_freshness_status(
    observation_timestamps: List[float],
    current_time: float,
    max_stale_seconds: float = 300.0,
) -> Dict[str, Any]:
    """Evaluate data freshness across incoming traffic sensor observations."""
    if not observation_timestamps:
        return {"status": "NO_DATA", "stale_ratio": 1.0, "max_age_seconds": None}

    ages = [current_time - t for t in observation_timestamps]
    stale_count = sum(1 for a in ages if a > max_stale_seconds)
    stale_ratio = stale_count / len(ages)

    return {
        "status": "STALE" if stale_ratio > 0.5 else "FRESH",
        "median_age_seconds": round(float(np.median(ages)), 1),
        "max_age_seconds": round(float(max(ages)), 1),
        "stale_observations_count": stale_count,
        "stale_ratio": round(stale_ratio, 3),
    }
