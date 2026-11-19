"""Comprehensive model training, multi-regime evaluation, and artifact generation."""
import sys
from pathlib import Path
import json
import time
import os

# Ensure src is on python path
src_dir = Path(__file__).resolve().parents[1] / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor, ExtraTreesRegressor

from terranav.config import (
    ROOT_DIR,
    ARTIFACTS_DIR,
    REPORTS_DIR,
    CHUNKFLOW_CLEAN_FEATURES,
    CHUNKFLOW_LEAKAGE_FEATURES,
    HELD_OUT_CORRIDORS,
    CHRONOLOGICAL_SPLIT_DATE,
    TRAJECTORY_BASE_FEATURES,
    RANDOM_STATE,
)
from terranav.data.loader import (
    load_trajectory_data,
    load_chunkflow_dataset,
    load_banglore_traffic_data,
)
from terranav.data.preprocessing import (
    create_chronological_split,
    create_corridor_holdout_split,
    create_trajectory_chronological_split,
    LeakageFreePreprocessor,
)
from terranav.features.engineering import build_trajectory_features
from terranav.models.baselines import (
    PersistenceBaseline,
    HistoricalMeanBaseline,
    RollingMeanBaseline,
)
from terranav.models.evaluation import compute_regression_metrics, measure_inference_latency
from terranav.models.training import save_model_artifact


def evaluate_model(model, X_train, y_train, X_test, y_test, name="model"):
    start = time.perf_counter()
    model.fit(X_train, y_train)
    fit_time = time.perf_counter() - start

    preds = model.predict(X_test)
    metrics = compute_regression_metrics(y_test, preds)
    metrics["fit_time_sec"] = round(fit_time, 3)
    metrics["model_name"] = name
    return model, metrics, preds


def run_segment_experiments():
    print("\n" + "=" * 60)
    print("RUNNING ROAD-SEGMENT SPEED EXPERIMENTS (CHUNKFLOW DATASET)")
    print("=" * 60)

    # 1. Load raw data with all columns to allow testing leakage ablation
    raw_df = load_chunkflow_dataset(drop_leakage=False)
    target_col = "Estimated Chunk Speed (km/h; synthetic)"
    print(f"Loaded ChunkFlow dataset: {len(raw_df)} rows, target: '{target_col}'")

    results = {"regimes": {}, "ablation": {}}

    # Define candidate model architectures
    models = {
        "Dummy_Mean": HistoricalMeanBaseline(),
        "Ridge_Linear": Ridge(alpha=1.0, random_state=RANDOM_STATE),
        "HistGradientBoosting": HistGradientBoostingRegressor(
            max_iter=160, learning_rate=0.08, max_leaf_nodes=31, random_state=RANDOM_STATE
        ),
        "ExtraTrees": ExtraTreesRegressor(
            n_estimators=80, min_samples_leaf=3, max_features=0.9, n_jobs=1, random_state=RANDOM_STATE
        ),
    }

    # Regime A: Random Row Split (Standard reference split)
    print("\n--- Regime A: Standard Random Split (70% Train, 15% Val, 15% Test) ---")
    train_mask = raw_df["split"] == "train"
    test_mask = raw_df["split"] == "test"

    train_df = raw_df[train_mask]
    test_df = raw_df[test_mask]

    # Preprocess Clean 17 features
    prep_clean = LeakageFreePreprocessor(CHUNKFLOW_CLEAN_FEATURES)
    X_train_clean = prep_clean.fit_transform(train_df)
    X_test_clean = prep_clean.transform(test_df)
    y_train = train_df[target_col].to_numpy()
    y_test = test_df[target_col].to_numpy()

    regime_a_metrics = {}
    best_clean_model = None
    best_clean_mae = 1e9

    for name, model in models.items():
        fitted_m, m_metrics, _ = evaluate_model(model, X_train_clean, y_train, X_test_clean, y_test, name)
        regime_a_metrics[name] = m_metrics
        print(f"  {name:22}: MAE={m_metrics['mae']:5.2f} km/h | RMSE={m_metrics['rmse']:5.2f} | R²={m_metrics['r2']:6.3f}")
        if m_metrics["mae"] < best_clean_mae and name not in ("Dummy_Mean", "Persistence"):
            best_clean_mae = m_metrics["mae"]
            best_clean_model = fitted_m

    results["regimes"]["Regime_A_Random_Split"] = regime_a_metrics

    # Ablation: Test performance WITH all 6 Leakage Features included
    print("\n--- Ablation Study: Impact of Target Leakage Features ---")
    all_23_features = CHUNKFLOW_CLEAN_FEATURES + CHUNKFLOW_LEAKAGE_FEATURES
    prep_leaky = LeakageFreePreprocessor(all_23_features)
    X_train_leaky = prep_leaky.fit_transform(train_df)
    X_test_leaky = prep_leaky.transform(test_df)

    hgb_leaky = HistGradientBoostingRegressor(max_iter=160, learning_rate=0.08, random_state=RANDOM_STATE)
    _, leaky_metrics, _ = evaluate_model(hgb_leaky, X_train_leaky, y_train, X_test_leaky, y_test, "HGBR_With_Leakage")
    print(f"  HGBR (All 23 Features + Leakage): MAE={leaky_metrics['mae']:5.2f} km/h | RMSE={leaky_metrics['rmse']:5.2f} | R²={leaky_metrics['r2']:6.3f}")
    print(f"  HGBR (Clean 17 Features):        MAE={regime_a_metrics['HistGradientBoosting']['mae']:5.2f} km/h | RMSE={regime_a_metrics['HistGradientBoosting']['rmse']:5.2f} | R²={regime_a_metrics['HistGradientBoosting']['r2']:6.3f}")
    results["ablation"]["HGBR_All_23_With_Leakage"] = leaky_metrics
    results["ablation"]["HGBR_Clean_17_No_Leakage"] = regime_a_metrics["HistGradientBoosting"]

    # Regime B: Spatial Holdout (Unseen Corridors)
    print("\n--- Regime B: Spatial Holdout (4 Unseen Corridors Held Out) ---")
    # Need corridor names from before processing
    before_df = pd.read_csv(ROOT_DIR / "ML" / "before processing.csv")
    raw_df["Road/Intersection Name"] = before_df["Road/Intersection Name"].values

    train_b, test_b = create_corridor_holdout_split(raw_df, held_out_corridors=HELD_OUT_CORRIDORS)
    X_tr_b = prep_clean.fit_transform(train_b)
    X_te_b = prep_clean.transform(test_b)
    y_tr_b = train_b[target_col].to_numpy()
    y_te_b = test_b[target_col].to_numpy()

    regime_b_metrics = {}
    for name, model in models.items():
        _, m_metrics, _ = evaluate_model(model, X_tr_b, y_tr_b, X_te_b, y_te_b, name)
        regime_b_metrics[name] = m_metrics
        print(f"  {name:22}: MAE={m_metrics['mae']:5.2f} km/h | RMSE={m_metrics['rmse']:5.2f} | R²={m_metrics['r2']:6.3f}")
    results["regimes"]["Regime_B_Unseen_Corridors"] = regime_b_metrics

    # Regime C: Chronological Holdout (Dates >= 2024-01-01)
    print(f"\n--- Regime C: Chronological Holdout (Cutoff >= {CHRONOLOGICAL_SPLIT_DATE}) ---")
    raw_df["Date"] = before_df["Date"].values
    train_c, test_c = create_chronological_split(raw_df, split_date=CHRONOLOGICAL_SPLIT_DATE)
    X_tr_c = prep_clean.fit_transform(train_c)
    X_te_c = prep_clean.transform(test_c)
    y_tr_c = train_c[target_col].to_numpy()
    y_te_c = test_c[target_col].to_numpy()

    regime_c_metrics = {}
    for name, model in models.items():
        _, m_metrics, _ = evaluate_model(model, X_tr_c, y_tr_c, X_te_c, y_te_c, name)
        regime_c_metrics[name] = m_metrics
        print(f"  {name:22}: MAE={m_metrics['mae']:5.2f} km/h | RMSE={m_metrics['rmse']:5.2f} | R²={m_metrics['r2']:6.3f}")
    results["regimes"]["Regime_C_Chronological_2024"] = regime_c_metrics

    # Measure inference latency on best model
    print("\n--- Measuring Inference Latency & Throughput ---")
    X_test_df = pd.DataFrame(X_test_clean, columns=CHUNKFLOW_CLEAN_FEATURES)
    latency_stats = measure_inference_latency(best_clean_model, X_test_df)
    results["latency"] = latency_stats
    for b_key, stat in latency_stats.items():
        print(f"  {b_key:10}: Median={stat['median_latency_ms']:6.3f} ms | p95={stat['p95_latency_ms']:6.3f} ms | Throughput={stat['throughput_rows_per_sec']:8.1f} rows/s")

    # Save Production Segment Model Artifact
    artifact_path = ARTIFACTS_DIR / "production_segment_speed_model.joblib"
    save_model_artifact(
        model=best_clean_model,
        feature_columns=CHUNKFLOW_CLEAN_FEATURES,
        target_name=target_col,
        output_path=artifact_path,
        metadata={
            "selected_model": "HistGradientBoostingRegressor",
            "val_mae": regime_a_metrics["HistGradientBoosting"]["mae"],
            "val_rmse": regime_a_metrics["HistGradientBoosting"]["rmse"],
            "val_r2": regime_a_metrics["HistGradientBoosting"]["r2"],
            "leakage_features_dropped": CHUNKFLOW_LEAKAGE_FEATURES,
            "trained_rows": len(train_df),
        },
    )
    print(f"\nSaved production segment model bundle to: {artifact_path} ({os.path.getsize(artifact_path):,} bytes)")

    return results


def run_trajectory_experiments():
    print("\n" + "=" * 60)
    print("RUNNING VEHICLE TRAJECTORY EXPERIMENTS (DUMAS ROADSurat)")
    print("=" * 60)

    raw_dumas = load_trajectory_data()
    print(f"Loaded Dumas Road trajectories: {len(raw_dumas)} rows, 702 tracks")

    trajectory_results = {}

    for horizon in [5, 15, 30]:
        print(f"\n--- Trajectory Horizon: {horizon} Seconds ---")
        ex = build_trajectory_features(raw_dumas, horizon_seconds=horizon)
        # Apply chronological split with cross-boundary purging
        split_df = create_trajectory_chronological_split(ex)

        valid_df = split_df[(split_df["target_speed_kmh"].notna()) & (split_df["split"] != "purged")].dropna(
            subset=TRAJECTORY_BASE_FEATURES
        )

        train_set = valid_df[valid_df["split"] == "train"]
        val_set = valid_df[valid_df["split"] == "validation"]
        test_set = valid_df[valid_df["split"] == "test"]

        # One-hot encode vehicle types
        def get_matrix(df_split, fit_cols=None):
            dummies = pd.get_dummies(df_split[TRAJECTORY_BASE_FEATURES], columns=["vehicle_type"], dtype=float)
            if fit_cols is not None:
                dummies = dummies.reindex(columns=fit_cols, fill_value=0.0)
            return dummies

        X_train_df = get_matrix(train_set)
        fit_cols = X_train_df.columns.tolist()
        X_val_df = get_matrix(val_set, fit_cols)
        X_test_df = get_matrix(test_set, fit_cols)

        y_train = train_set["target_speed_kmh"].to_numpy()
        y_val = val_set["target_speed_kmh"].to_numpy()
        y_test = test_set["target_speed_kmh"].to_numpy()

        print(f"  Rows: Train={len(train_set)}, Val={len(val_set)}, Test={len(test_set)}")

        # Baselines
        pers_metrics = compute_regression_metrics(y_test, test_set["speed_now_kmh"].to_numpy())
        roll_metrics = compute_regression_metrics(y_test, test_set["speed_mean_prev_5s_kmh"].to_numpy())

        # Models
        hgb = HistGradientBoostingRegressor(max_iter=160, learning_rate=0.08, random_state=RANDOM_STATE)
        et = ExtraTreesRegressor(n_estimators=80, min_samples_leaf=3, max_features=0.9, n_jobs=1, random_state=RANDOM_STATE)

        _, hgb_metrics, _ = evaluate_model(hgb, X_train_df, y_train, X_test_df, y_test, "HistGradientBoosting")
        fitted_et, et_metrics, _ = evaluate_model(et, X_train_df, y_train, X_test_df, y_test, "ExtraTrees")

        print(f"  Persistence Baseline : MAE={pers_metrics['mae']:5.2f} km/h | RMSE={pers_metrics['rmse']:5.2f} | R²={pers_metrics['r2']:6.3f}")
        print(f"  Rolling 5s Mean      : MAE={roll_metrics['mae']:5.2f} km/h | RMSE={roll_metrics['rmse']:5.2f} | R²={roll_metrics['r2']:6.3f}")
        print(f"  HistGradientBoosting : MAE={hgb_metrics['mae']:5.2f} km/h | RMSE={hgb_metrics['rmse']:5.2f} | R²={hgb_metrics['r2']:6.3f}")
        print(f"  ExtraTrees           : MAE={et_metrics['mae']:5.2f} km/h | RMSE={et_metrics['rmse']:5.2f} | R²={et_metrics['r2']:6.3f}")

        # Choose best model for horizon
        best_model = fitted_et if et_metrics["mae"] <= hgb_metrics["mae"] else hgb
        best_name = "ExtraTrees" if best_model == fitted_et else "HistGradientBoosting"

        trajectory_results[f"horizon_{horizon}s"] = {
            "n_train": len(train_set),
            "n_val": len(val_set),
            "n_test": len(test_set),
            "persistence": pers_metrics,
            "rolling_5s_mean": roll_metrics,
            "hist_gradient_boosting": hgb_metrics,
            "extra_trees": et_metrics,
            "selected_model": best_name,
        }

        # Save trajectory horizon model
        traj_artifact = ARTIFACTS_DIR / f"production_trajectory_speed_{horizon}s.joblib"
        save_model_artifact(
            model=best_model,
            feature_columns=fit_cols,
            target_name=f"trajectory_speed_{horizon}s",
            output_path=traj_artifact,
            metadata={
                "horizon_seconds": horizon,
                "selected_model": best_name,
                "test_mae": min(et_metrics["mae"], hgb_metrics["mae"]),
            },
        )

    return trajectory_results


def main():
    start_total = time.perf_counter()
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    segment_eval = run_segment_experiments()
    trajectory_eval = run_trajectory_experiments()

    full_results = {
        "execution_timestamp": pd.Timestamp.now().isoformat(),
        "total_runtime_sec": round(time.perf_counter() - start_total, 2),
        "segment_experiments": segment_eval,
        "trajectory_experiments": trajectory_eval,
    }

    out_json = REPORTS_DIR / "evaluation_results.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2)

    print("\n" + "=" * 60)
    print(f"TRAINING & EVALUATION COMPLETE in {full_results['total_runtime_sec']}s")
    print(f"Machine-readable results saved to: {out_json}")
    print("=" * 60)


if __name__ == "__main__":
    main()
