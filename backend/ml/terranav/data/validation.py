"""Data validation, physical boundary checking, and unit conversions."""
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from terranav.config import (
    KMH_TO_MPS,
    MPS_TO_KMH,
    MIN_SPEED_FLOOR_KMH,
    MIN_SPEED_FLOOR_MPS,
    MAX_PHYSICAL_SPEED_KMH,
    IMPASSABLE_COST_SECONDS,
)


def validate_coordinates(lat: float, lon: float) -> bool:
    """Validate WGS84 geographic coordinate bounds."""
    if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
        return False
    if np.isnan(lat) or np.isnan(lon) or np.isinf(lat) or np.isinf(lon):
        return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def validate_segment_length(length_meters: float) -> bool:
    """Validate road segment length is strictly positive and physically plausible."""
    if not isinstance(length_meters, (int, float)) or np.isnan(length_meters):
        return False
    return 1.0 <= length_meters <= 100_000.0  # Between 1m and 100km


def speed_to_travel_time(
    length_meters: float,
    speed_kmh: float,
    min_speed_floor_kmh: float = MIN_SPEED_FLOOR_KMH,
    is_closed: bool = False,
) -> float:
    """
    Convert road segment length and speed to travel time in seconds.

    Formula:
        T = L / max(v_mps, v_min_mps)

    Args:
        length_meters: Length of road segment in meters.
        speed_kmh: Traversal speed in kilometers per hour.
        min_speed_floor_kmh: Minimum speed floor to prevent division by zero or negative time.
        is_closed: Flag indicating full road closure / barrier.

    Returns:
        Travel time in seconds (or IMPASSABLE_COST_SECONDS if closed).
    """
    if is_closed:
        return IMPASSABLE_COST_SECONDS

    if not validate_segment_length(length_meters):
        raise ValueError(f"Invalid segment length: {length_meters}m")

    # Clamping speed to documented floor and realistic maximum
    effective_speed_kmh = max(float(speed_kmh), min_speed_floor_kmh)
    effective_speed_kmh = min(effective_speed_kmh, MAX_PHYSICAL_SPEED_KMH)

    speed_mps = effective_speed_kmh * KMH_TO_MPS
    travel_time_seconds = length_meters / speed_mps
    return float(travel_time_seconds)


def travel_time_to_speed_kmh(length_meters: float, duration_seconds: float) -> float:
    """Derive speed in km/h from length in meters and traversal duration in seconds."""
    if duration_seconds <= 0.0 or length_meters <= 0.0:
        return MIN_SPEED_FLOOR_KMH
    speed_mps = length_meters / duration_seconds
    return float(speed_mps * MPS_TO_KMH)


def validate_trajectory_table(frame: pd.DataFrame) -> Tuple[bool, List[str]]:
    """Validate Dumas Road trajectory dataset schema and invariants."""
    errors = []
    required_cols = [
        "Vehicle No.",
        "Time (s)",
        "vehicle type",
        "logitudinal",
        "lateral",
        "longitudinal speed",
        "longitudinal accleration",
        "lateral velocity",
        "lateral acceleration",
    ]
    missing = set(required_cols) - set(frame.columns)
    if missing:
        errors.append(f"Missing required trajectory columns: {sorted(missing)}")
        return False, errors

    if frame[required_cols].isna().any().any():
        errors.append("Dataset contains null values in required columns")

    # Check sampling frequency on first few vehicle tracks
    sample_tracks = frame["Vehicle No."].unique()[:20]
    for track_id in sample_tracks:
        track_df = frame[frame["Vehicle No."] == track_id].sort_values("Time (s)")
        diffs = track_df["Time (s)"].diff().dropna()
        if not diffs.empty and not np.allclose(diffs, 0.5, atol=1e-3):
            errors.append(f"Track {track_id} has irregular sampling intervals (expected 0.5s)")
            break

    return len(errors) == 0, errors


def validate_chunkflow_table(frame: pd.DataFrame, check_leakage: bool = True) -> Tuple[bool, List[str]]:
    """Validate ChunkFlow segment table and check for presence of leakage columns."""
    errors = []
    required_targets = [
        "Estimated Chunk Speed (km/h; synthetic)",
        "Observed Chunk Traffic Density (veh/km)",
    ]
    for target in required_targets:
        if target not in frame.columns:
            errors.append(f"Missing expected target column: '{target}'")

    if check_leakage:
        leak_cols = [c for c in frame.columns if "LEAK" in c or c.startswith("x_LEAK_")]
        if leak_cols:
            errors.append(f"Forbidden leakage columns found: {leak_cols}")

    return len(errors) == 0, errors
