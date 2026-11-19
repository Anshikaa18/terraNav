"""Data loading functions for trajectory and road-segment traffic datasets."""
from pathlib import Path
from typing import Optional, Tuple
import pandas as pd
import numpy as np

from terranav.config import (
    DUMAS_TRAJECTORY_PATH,
    BANGLORE_TRAFFIC_PATH,
    CHUNKFLOW_BEFORE_PATH,
    CHUNKFLOW_AFTER_PATH,
    CHUNKFLOW_LEAKAGE_FEATURES,
    CHUNKFLOW_CLEAN_FEATURES,
    MPS_TO_KMH,
)
from terranav.data.validation import validate_trajectory_table


def load_trajectory_data(path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load and preprocess the Dumas Road vehicle trajectory dataset.

    Args:
        path: Path to the Trajectorydatadumasroad.xlsx file.

    Returns:
        Clean DataFrame with normalized column names, absolute speed in km/h,
        and chronological ordering per track.
    """
    file_path = path or DUMAS_TRAJECTORY_PATH
    if not file_path.exists():
        raise FileNotFoundError(f"Trajectory dataset not found at: {file_path}")

    # Read with header=23 to skip the 23 narrative preamble rows
    df = pd.read_excel(file_path, header=23)
    df.columns = [str(c).strip() for c in df.columns]

    is_valid, errors = validate_trajectory_table(df)
    if not is_valid:
        raise ValueError(f"Trajectory table failed validation: {errors}")

    # Ensure numeric types
    numeric_cols = [
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
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Sort chronologically within each track
    df = df.sort_values(["Vehicle No.", "Time (s)"]).reset_index(drop=True)

    # Physical speed transformation:
    # Source speed is signed m/s; convert magnitude to km/h for routing/traffic forecasting.
    # Preserve sign flag as reverse_direction indicator.
    df["speed_kmh"] = df["longitudinal speed"].abs() * MPS_TO_KMH
    df["is_reverse_direction"] = (df["longitudinal speed"] < 0).astype(int)

    return df


def load_banglore_traffic_data(path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load the Bengaluru corridor-level daily traffic dataset.

    Args:
        path: Path to Banglore_traffic_Dataset.csv.

    Returns:
        DataFrame with parsed dates and corridor identifiers.
    """
    file_path = path or BANGLORE_TRAFFIC_PATH
    if not file_path.exists():
        raise FileNotFoundError(f"Bengaluru traffic dataset not found at: {file_path}")

    df = pd.read_csv(file_path)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["Date", "Road/Intersection Name"]).reset_index(drop=True)
    return df


def load_chunkflow_dataset(
    path: Optional[Path] = None,
    drop_leakage: bool = True,
) -> pd.DataFrame:
    """
    Load the ChunkFlow road-segment dataset (after processing.csv).

    Args:
        path: Path to after processing.csv.
        drop_leakage: If True, unconditionally drops all x_LEAK_* features.

    Returns:
        DataFrame ready for modeling or evaluation.
    """
    file_path = path or CHUNKFLOW_AFTER_PATH
    if not file_path.exists():
        raise FileNotFoundError(f"ChunkFlow dataset not found at: {file_path}")

    df = pd.read_csv(file_path)

    if drop_leakage:
        cols_to_drop = [c for c in df.columns if c in CHUNKFLOW_LEAKAGE_FEATURES or "x_LEAK_" in c]
        df = df.drop(columns=cols_to_drop)

    return df
