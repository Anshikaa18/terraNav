"""Preprocessing, split generation, and data transformation pipeline."""
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

from terranav.config import (
    HELD_OUT_CORRIDORS,
    CHRONOLOGICAL_SPLIT_DATE,
    CHUNKFLOW_CLEAN_FEATURES,
    RANDOM_STATE,
)


def create_chronological_split(
    df: pd.DataFrame,
    date_column: str = "Date",
    split_date: str = CHRONOLOGICAL_SPLIT_DATE,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split tabular data strictly chronologically (Regime C).
    Train: dates strictly before split_date.
    Test: dates on or after split_date.
    """
    cutoff = pd.to_datetime(split_date)
    dates = pd.to_datetime(df[date_column])
    train_mask = dates < cutoff
    test_mask = dates >= cutoff
    return df[train_mask].copy(), df[test_mask].copy()


def create_corridor_holdout_split(
    df: pd.DataFrame,
    corridor_column: str = "Road/Intersection Name",
    held_out_corridors: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split data spatially by holding out complete corridors (Regime B).
    Train: corridors not in held_out_corridors.
    Test: corridors in held_out_corridors.
    """
    held_out = held_out_corridors or HELD_OUT_CORRIDORS
    test_mask = df[corridor_column].isin(held_out)
    train_mask = ~test_mask
    return df[train_mask].copy(), df[test_mask].copy()


def create_trajectory_chronological_split(
    df: pd.DataFrame,
    track_col: str = "Vehicle No.",
    time_col: str = "Time (s)",
    train_fraction: float = 0.60,
    val_fraction: float = 0.20,
) -> pd.DataFrame:
    """
    Chronological trajectory split with cross-boundary purging.

    Tracks that cross split boundaries are tagged as 'purged' and discarded from
    training, validation, and testing to prevent track-identity data leakage.
    """
    ordered = df.sort_values([track_col, time_col]).copy()
    max_time = float(ordered[time_col].max())
    train_limit = max_time * train_fraction
    val_limit = max_time * (train_fraction + val_fraction)

    spans = ordered.groupby(track_col)[time_col].agg(["min", "max"])

    train_track_ids = spans.index[spans["max"] <= train_limit]
    val_track_ids = spans.index[(spans["min"] > train_limit) & (spans["max"] <= val_limit)]
    test_track_ids = spans.index[spans["min"] > val_limit]

    split_series = np.full(len(ordered), "purged", dtype=object)
    split_series[ordered[track_col].isin(train_track_ids).to_numpy()] = "train"
    split_series[ordered[track_col].isin(val_track_ids).to_numpy()] = "validation"
    split_series[ordered[track_col].isin(test_track_ids).to_numpy()] = "test"

    ordered["split"] = split_series
    return ordered


class LeakageFreePreprocessor(BaseEstimator, TransformerMixin):
    """
    Feature preprocessor fitted exclusively on training data.
    Imputes missing values and standardizes features without test leakage.
    """

    def __init__(self, feature_cols: Optional[List[str]] = None):
        self.feature_cols = feature_cols or CHUNKFLOW_CLEAN_FEATURES
        self.imputer = SimpleImputer(strategy="mean")
        self.scaler = StandardScaler()
        self.fitted_ = False

    def fit(self, X: pd.DataFrame, y=None):
        X_sub = X[self.feature_cols]
        X_imp = self.imputer.fit_transform(X_sub)
        self.scaler.fit(X_imp)
        self.fitted_ = True
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if not self.fitted_:
            raise ValueError("Preprocessor has not been fitted.")
        X_sub = X[self.feature_cols]
        X_imp = self.imputer.transform(X_sub)
        return self.scaler.transform(X_imp)

    def fit_transform(self, X: pd.DataFrame, y=None) -> np.ndarray:
        return self.fit(X, y).transform(X)
