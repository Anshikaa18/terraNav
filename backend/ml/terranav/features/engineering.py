"""Feature engineering for trajectory speed prediction and road segment forecasting."""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from terranav.config import (
    TRAJECTORY_BASE_FEATURES,
    CHUNKFLOW_CLEAN_FEATURES,
    MPS_TO_KMH,
    KMH_TO_MPS,
    MIN_SPEED_FLOOR_KMH,
)
from terranav.data.validation import speed_to_travel_time


def build_trajectory_features(
    df: pd.DataFrame,
    horizon_seconds: int = 5,
) -> pd.DataFrame:
    """
    Construct leakage-safe features and exact future-speed target for vehicle trajectories.

    Args:
        df: Dumas Road trajectory DataFrame.
        horizon_seconds: Prediction horizon in seconds (5, 15, or 30).

    Returns:
        DataFrame with past-only features and target_speed_kmh at t + horizon_seconds.
    """
    track_col = "Vehicle No."
    time_col = "Time (s)"
    speed_col = "longitudinal speed"

    ordered = df.sort_values([track_col, time_col]).copy()
    group = ordered.groupby(track_col, sort=False)

    # Physical speed magnitude at current time t
    now_kmh = ordered[speed_col].abs() * MPS_TO_KMH

    ordered["time_s"] = ordered[time_col]
    ordered["position_m"] = ordered["logitudinal"]
    ordered["lateral_position_m"] = ordered["lateral"]
    ordered["vehicle_type"] = ordered["vehicle type"].astype(int)
    ordered["speed_now_kmh"] = now_kmh
    ordered["acceleration_mps2"] = ordered["longitudinal accleration"]
    ordered["lateral_velocity_mps"] = ordered["lateral velocity"]
    ordered["lateral_acceleration_mps2"] = ordered["lateral acceleration"]

    # Historical lags strictly before t
    # 0.5s sampling -> 4 steps = 2.0s; 10 steps = 5.0s
    ordered["speed_lag_2s_kmh"] = group[speed_col].shift(4).abs() * MPS_TO_KMH
    ordered["speed_lag_5s_kmh"] = group[speed_col].shift(10).abs() * MPS_TO_KMH

    # Rolling mean over prior 5 seconds (10 steps) strictly excluding current sample
    prior_speed = group[speed_col].shift(1).abs() * MPS_TO_KMH
    ordered["speed_mean_prev_5s_kmh"] = (
        prior_speed.groupby(ordered[track_col], sort=False)
        .transform(lambda s: s.rolling(10, min_periods=1).mean())
    )

    # Exact future target lookup at t + horizon_seconds
    target_lookup = ordered.set_index([track_col, time_col])[speed_col]
    target_indices = pd.MultiIndex.from_arrays([ordered[track_col], ordered[time_col] + horizon_seconds])
    target_speed_signed = target_lookup.reindex(target_indices).to_numpy()

    # Absolute speed magnitude in km/h
    ordered["target_speed_kmh"] = np.abs(target_speed_signed) * MPS_TO_KMH

    return ordered


def prepare_segment_feature_matrix(
    df: pd.DataFrame,
    feature_cols: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Extract the verified clean 17-feature matrix for road-segment prediction.
    Ensures all expected feature columns exist and handles missing values.
    """
    cols = feature_cols or CHUNKFLOW_CLEAN_FEATURES
    X = pd.DataFrame(index=df.index)
    for c in cols:
        if c in df.columns:
            X[c] = pd.to_numeric(df[c], errors="coerce")
        else:
            X[c] = 0.0
    return X


def derive_segment_travel_times(
    lengths_meters: pd.Series,
    speeds_kmh: pd.Series,
    min_speed_floor: float = MIN_SPEED_FLOOR_KMH,
) -> pd.Series:
    """Vectorized calculation of segment travel times in seconds from lengths and speeds."""
    effective_speeds_kmh = np.maximum(speeds_kmh.to_numpy(), min_speed_floor)
    speeds_mps = effective_speeds_kmh * KMH_TO_MPS
    return pd.Series(lengths_meters.to_numpy() / speeds_mps, index=lengths_meters.index)
