"""Model evaluation metrics, multi-regime evaluation, and ablation comparisons."""
from typing import Dict, List, Optional, Tuple, Any
import time
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, median_absolute_error


def compute_regression_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    unit: str = "km/h",
) -> Dict[str, Any]:
    """Compute regression metrics including MAE, RMSE, MedAE, and R^2."""
    y_t = np.asarray(y_true, dtype=float)
    y_p = np.asarray(y_pred, dtype=float)

    # Filter any NaNs
    valid = ~(np.isnan(y_t) | np.isnan(y_p))
    y_t = y_t[valid]
    y_p = y_p[valid]

    if len(y_t) == 0:
        return {"mae": 0.0, "rmse": 0.0, "r2": 0.0, "medae": 0.0, "n_samples": 0}

    mae = float(mean_absolute_error(y_t, y_p))
    rmse = float(np.sqrt(mean_squared_error(y_t, y_p)))
    medae = float(median_absolute_error(y_t, y_p))
    r2 = float(r2_score(y_t, y_p))

    # Calculate percentage error on positive values
    non_zero = y_t > 1.0
    if np.sum(non_zero) > 10:
        mape = float(np.mean(np.abs((y_t[non_zero] - y_p[non_zero]) / y_t[non_zero])) * 100.0)
    else:
        mape = 0.0

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "medae": round(medae, 3),
        "r2": round(r2, 4),
        "mape_percent": round(mape, 2),
        "unit": unit,
        "n_samples": int(len(y_t)),
    }


def measure_inference_latency(
    model,
    X_sample: pd.DataFrame,
    batch_sizes: Optional[List[int]] = None,
    n_repetitions: int = 30,
) -> Dict[str, Any]:
    """Measure inference latency across warm batches to report median, p95, and throughput."""
    sizes = batch_sizes or [1, 16, 64, 256]
    results = {}

    for size in sizes:
        batch = X_sample.iloc[: min(size, len(X_sample))].copy()
        if len(batch) == 0:
            continue

        # Warm-up run
        model.predict(batch)

        timings = []
        for _ in range(n_repetitions):
            start = time.perf_counter()
            model.predict(batch)
            timings.append(time.perf_counter() - start)

        timings_ms = np.array(timings) * 1000.0
        results[f"batch_{size}"] = {
            "batch_size": len(batch),
            "median_latency_ms": round(float(np.median(timings_ms)), 3),
            "p95_latency_ms": round(float(np.percentile(timings_ms, 95)), 3),
            "p99_latency_ms": round(float(np.percentile(timings_ms, 99)), 3),
            "throughput_rows_per_sec": round(float(len(batch) / (np.median(timings) + 1e-9)), 1),
        }

    return results
