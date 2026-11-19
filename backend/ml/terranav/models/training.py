"""Model training, hyperparameter selection, and artifact serialization."""
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.linear_model import Ridge
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor

from terranav.config import (
    ARTIFACTS_DIR,
    RANDOM_STATE,
    CHUNKFLOW_CLEAN_FEATURES,
)
from terranav.models.baselines import (
    PersistenceBaseline,
    HistoricalMeanBaseline,
    RollingMeanBaseline,
)


def get_candidate_regressors(random_state: int = RANDOM_STATE) -> Dict[str, BaseEstimator]:
    """Return dictionary of candidate models for speed and travel-time forecasting."""
    return {
        "persistence_baseline": PersistenceBaseline(),
        "historical_mean_baseline": HistoricalMeanBaseline(),
        "ridge_linear": Ridge(alpha=1.0, random_state=random_state),
        "hist_gradient_boosting": HistGradientBoostingRegressor(
            max_iter=160,
            learning_rate=0.08,
            max_leaf_nodes=31,
            l2_regularization=1.0,
            random_state=random_state,
        ),
        "extra_trees": ExtraTreesRegressor(
            n_estimators=100,
            min_samples_leaf=3,
            max_features=0.9,
            n_jobs=1,
            random_state=random_state,
        ),
    }


def train_and_select_best_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    candidates: Optional[Dict[str, BaseEstimator]] = None,
) -> Tuple[str, BaseEstimator, Dict[str, Any]]:
    """
    Train candidate models on train data, evaluate on validation data, and select the best model.
    Selection criterion: Lowest Validation MAE.
    """
    models = candidates or get_candidate_regressors()
    val_results = {}
    fitted_models = {}

    for name, model in models.items():
        start_time = time.perf_counter()
        model.fit(X_train, y_train)
        train_duration = time.perf_counter() - start_time

        val_preds = model.predict(X_val)
        mae = float(np.mean(np.abs(val_preds - y_val)))
        rmse = float(np.sqrt(np.mean((val_preds - y_val) ** 2)))

        y_var = np.var(y_val)
        r2 = float(1.0 - (rmse ** 2) / (y_var + 1e-9))

        val_results[name] = {
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "train_duration_sec": train_duration,
        }
        fitted_models[name] = model

    # Select model with minimum validation MAE
    best_name = min(val_results, key=lambda k: val_results[k]["mae"])
    best_model = fitted_models[best_name]

    return best_name, best_model, val_results


def save_model_artifact(
    model: BaseEstimator,
    feature_columns: List[str],
    target_name: str,
    output_path: Path,
    metadata: Optional[Dict[str, Any]] = None,
) -> Path:
    """Save trained model along with schema metadata and feature names in a unified bundle."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": model,
        "feature_columns": feature_columns,
        "target_name": target_name,
        "schema_version": "production-v1.0",
        "saved_at": pd.Timestamp.now().isoformat(),
        "metadata": metadata or {},
    }
    joblib.dump(bundle, output_path, compress=3)
    return output_path
