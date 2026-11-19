"""Baseline models for traffic speed and travel time forecasting."""
from typing import Dict, List, Optional, Union
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin


class PersistenceBaseline(BaseEstimator, RegressorMixin):
    """
    Persistence baseline: Future speed equals the most recent valid observation.
    Assumes conditions remain unchanged over the forecast horizon.
    """

    def __init__(self, speed_column_idx: int = 0):
        self.speed_column_idx = speed_column_idx
        self.mean_fallback_ = 40.0

    def fit(self, X: Union[np.ndarray, pd.DataFrame], y: np.ndarray):
        y_arr = np.asarray(y, dtype=float)
        self.mean_fallback_ = float(np.nanmean(y_arr)) if len(y_arr) > 0 else 40.0
        return self

    def predict(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        if isinstance(X, pd.DataFrame):
            # Check for column name or fallback to index
            if "speed_now_kmh" in X.columns:
                preds = X["speed_now_kmh"].to_numpy(dtype=float)
            elif "Average Speed" in X.columns:
                preds = X["Average Speed"].to_numpy(dtype=float)
            else:
                preds = X.iloc[:, self.speed_column_idx].to_numpy(dtype=float)
        else:
            preds = np.asarray(X)[:, self.speed_column_idx].astype(float)

        # Impute missing with training mean fallback
        nan_mask = np.isnan(preds)
        if np.any(nan_mask):
            preds[nan_mask] = self.mean_fallback_
        return preds


class HistoricalMeanBaseline(BaseEstimator, RegressorMixin):
    """
    Historical mean baseline: Predicts the global or group mean target value
    calculated over historical training observations.
    """

    def __init__(self):
        self.global_mean_ = 0.0

    def fit(self, X: Union[np.ndarray, pd.DataFrame], y: np.ndarray):
        y_arr = np.asarray(y, dtype=float)
        self.global_mean_ = float(np.nanmean(y_arr))
        return self

    def predict(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        n_samples = len(X)
        return np.full(n_samples, self.global_mean_, dtype=float)


class RollingMeanBaseline(BaseEstimator, RegressorMixin):
    """
    Rolling window baseline: Predicts the average of recent historical window observations.
    Useful for micro-trajectories (e.g. mean speed over previous 5 seconds).
    """

    def __init__(self, rolling_col_name: str = "speed_mean_prev_5s_kmh"):
        self.rolling_col_name = rolling_col_name
        self.fallback_mean_ = 40.0

    def fit(self, X: pd.DataFrame, y: np.ndarray):
        self.fallback_mean_ = float(np.nanmean(y))
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if isinstance(X, pd.DataFrame) and self.rolling_col_name in X.columns:
            preds = X[self.rolling_col_name].to_numpy(dtype=float)
            nan_mask = np.isnan(preds)
            preds[nan_mask] = self.fallback_mean_
            return preds
        return np.full(len(X), self.fallback_mean_, dtype=float)
