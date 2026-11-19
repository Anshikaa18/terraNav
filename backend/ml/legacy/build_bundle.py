"""
Build the ChunkFlow trained models and preprocessing bundle (leakage-free schema).
Models are fit strictly on the repository training partition using 17 clean features.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

import compat
import joblib

ROOT = Path(__file__).resolve().parent

CLEAN_FEATURE_COLUMNS = [
    "x_Estimated Chunk Traffic Volume (synthetic)",
    "x_Estimated Queue Length (m; synthetic)",
    "x_Estimated Signal Delay (sec; synthetic)",
    "x_Estimated Incident Delay (sec; synthetic)",
    "x_Estimated Roadwork Delay (sec; synthetic)",
    "x_Chunk Length (m)",
    "x_Road Capacity Utilization",
    "x_Traffic Signal Present_Yes",
    "x_Roadwork in Chunk_Yes",
    "x_Weather Conditions_Fog",
    "x_Weather Conditions_Overcast",
    "x_Weather Conditions_Rain",
    "x_Weather Conditions_Windy",
    "x_Chunk Sequence_2",
    "x_Chunk Sequence_3",
    "x_Chunk Sequence_4",
    "x_Chunk Sequence_5",
]

TARGET_COLUMNS = [
    "Observed Chunk Traffic Density (veh/km)",
    "Estimated Chunk Speed (km/h; synthetic)",
]

TRANSFORM_CONFIGS = [
    ("x_Estimated Chunk Traffic Volume (synthetic)", "Estimated Chunk Traffic Volume (synthetic)", "log1p"),
    ("x_Estimated Queue Length (m; synthetic)", "Estimated Queue Length (m; synthetic)", "log1p"),
    ("x_Estimated Signal Delay (sec; synthetic)", "Estimated Signal Delay (sec; synthetic)", "log1p"),
    ("x_Estimated Incident Delay (sec; synthetic)", "Estimated Incident Delay (sec; synthetic)", "log1p"),
    ("x_Estimated Roadwork Delay (sec; synthetic)", "Estimated Roadwork Delay (sec; synthetic)", "log1p"),
    ("x_Chunk Length (m)", "Chunk Length (m)", None),
    ("x_Road Capacity Utilization", "Road Capacity Utilization", None),
]


def build():
    print("Loading original training datasets...")
    df_before = pd.read_csv(ROOT / "before processing.csv")
    df_after = pd.read_csv(ROOT / "after processing.csv")
    train_mask = df_after["split"] == "train"

    transform_params = {}
    for feat_name, source_col, trans in TRANSFORM_CONFIGS:
        raw = df_before.loc[train_mask, source_col]
        if trans == "log1p":
            raw = np.log1p(raw.astype(float))
        else:
            raw = raw.astype(float)

        mean_val = float(raw.mean())
        scale_val = float(raw.std(ddof=0)) or 1.0
        transform_params[feat_name] = {"mean": mean_val, "scale": scale_val}
        print(f"  {feat_name}: mean={mean_val:.6f}, scale={scale_val:.6f}")

    X_train = df_after.loc[train_mask, CLEAN_FEATURE_COLUMNS]
    models = {}
    metrics = {}

    for target in TARGET_COLUMNS:
        y_train = df_after.loc[train_mask, target]
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean")),
            # This estimator avoids the incompatible NumPy Generator state
            # serialized by the previous HistGradientBoostingRegressor bundle.
            ("model", GradientBoostingRegressor(
                n_estimators=100,
                min_samples_leaf=2,
                random_state=42,
            )),
        ])
        pipe.fit(X_train, y_train)
        models[target] = pipe
        y_hat = pipe.predict(X_train)
        mae = float(np.mean(np.abs(y_train - y_hat)))
        metrics[target] = {"train_mae": round(mae, 4)}
        print(f"  Trained {target} (train MAE={mae:.4f})")

    eval_summary = {}
    eval_path = ROOT / "model_evaluation_summary.json"
    if eval_path.exists():
        with open(eval_path, "r", encoding="utf-8") as f:
            eval_summary = json.load(f)

    bundle = {
        "models": models,
        "feature_columns": CLEAN_FEATURE_COLUMNS,
        "target_columns": TARGET_COLUMNS,
        "transform_params": transform_params,
        "model_version": "ChunkFlow-v2.0-Clean17",
        "feature_schema_version": "clean-17-v1",
        "leakage_features_excluded": True,
        "model_evaluation": eval_summary,
        "training_partition_rows": int(train_mask.sum()),
        "total_rows": int(len(df_after)),
        "clean_training_metrics": metrics,
    }

    out_path = ROOT / "ChunkFlow_Trained_Models_and_Preprocessing.joblib"
    joblib.dump(bundle, out_path, compress=3)
    print(f"Bundle successfully created at: {out_path} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
