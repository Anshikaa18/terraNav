"""
ChunkFlow ML Model Audit & Independent Evaluation Script
Implements:
1. Complete 23-feature audit and physical target derivations.
2. Leakage analysis (unmasking x_LEAK_ features and correlations).
3. Benchmark against DummyRegressor (Mean baseline) and Ridge regression.
4. Defensible Split Regimes:
   - Regime A: Original Repository Split (Random row-level partition with known spatial/temporal overlap).
   - Regime B: Corridor-Held-Out Evaluation (Trained on 12 corridors, tested on 4 unseen corridors).
   - Regime C: Chronological Evaluation (Trained on 2022-2023 dates, tested strictly on 2024 dates).
5. Leakage Impact Comparison: Full 23 features vs. Clean 17 features (LEAK removed).
6. Strict training-only fitting of scalers, imputers, and models.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
import joblib

ROOT = Path(__file__).resolve().parent
BUNDLE_PATH = ROOT / "ChunkFlow_Trained_Models_and_Preprocessing.joblib"

def compute_metrics(y_true, y_pred):
    return {
        "R2": round(float(r2_score(y_true, y_pred)), 4),
        "MAE": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4)
    }

def fit_and_evaluate(X_train, y_train, X_test, y_test, model_type="hgbr"):
    """Fit strictly on training set and evaluate on test set."""
    if model_type == "dummy":
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean")),
            ("model", DummyRegressor(strategy="mean"))
        ])
    elif model_type == "ridge":
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean")),
            ("model", Ridge(alpha=1.0))
        ])
    elif model_type == "hgbr":
        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean")),
            ("model", HistGradientBoostingRegressor(max_iter=100, random_state=42))
        ])
    else:
        raise ValueError(f"Unknown model_type: {model_type}")

    pipe.fit(X_train, y_train)
    y_pred_train = pipe.predict(X_train)
    y_pred_test = pipe.predict(X_test)

    return {
        "train": compute_metrics(y_train, y_pred_train),
        "test": compute_metrics(y_test, y_pred_test)
    }

def audit():
    print("Loading datasets...")
    df_after = pd.read_csv(ROOT / "after processing.csv")
    df_before = pd.read_csv(ROOT / "before processing.csv")
    bundle = joblib.load(BUNDLE_PATH)

    all_features = bundle["feature_columns"]
    clean_features = [f for f in all_features if not f.startswith("x_LEAK_")]
    target_cols = bundle["target_columns"]

    print(f"Total rows: {len(df_after)}")
    print(f"Features: total={len(all_features)}, clean={len(clean_features)}, leak={len(all_features)-len(clean_features)}")

    results = {
        "dataset_metadata": {
            "total_rows": len(df_after),
            "corridors_count": int(df_before["Road/Intersection Name"].nunique()),
            "corridors": list(df_before["Road/Intersection Name"].unique()),
            "date_range": [str(df_before["Date"].min()), str(df_before["Date"].max())],
            "unique_dates": int(df_before["Date"].nunique())
        },
        "regime_A_original_split": {},
        "regime_B_corridor_held_out": {},
        "regime_C_chronological_holdout": {},
        "feature_correlations": {}
    }

    # --------------------------------------------------------------------------
    # 1. Feature Correlations & Leakage Investigation
    # --------------------------------------------------------------------------
    print("\n[1. Target Leakage & Feature Correlations]")
    corrs = {}
    for target in target_cols:
        target_corr = {}
        for feat in all_features:
            c = float(df_after[feat].corr(df_after[target]))
            target_corr[feat] = round(c, 4)
        corrs[target] = target_corr
    results["feature_correlations"] = corrs

    with open(ROOT / "audit_feature_correlations.json", "w", encoding="utf-8") as f:
        json.dump(corrs, f, indent=2)

    # --------------------------------------------------------------------------
    # 2. Regime A: Original Split
    # --------------------------------------------------------------------------
    print("\n[2. Regime A: Original Repository Split]")
    train_mask_A = df_after["split"] == "train"
    test_mask_A = df_after["split"] == "test"

    regime_A_res = {
        "train_rows": int(train_mask_A.sum()),
        "test_rows": int(test_mask_A.sum()),
        "targets": {}
    }

    for target in target_cols:
        y_train = df_after.loc[train_mask_A, target]
        y_test = df_after.loc[test_mask_A, target]

        regime_A_res["targets"][target] = {
            "target_mean": round(float(y_train.mean()), 2),
            "target_std": round(float(y_train.std()), 2),
            "all_features_23": {
                "dummy_baseline": fit_and_evaluate(df_after.loc[train_mask_A, all_features], y_train, df_after.loc[test_mask_A, all_features], y_test, "dummy"),
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_A, all_features], y_train, df_after.loc[test_mask_A, all_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_A, all_features], y_train, df_after.loc[test_mask_A, all_features], y_test, "hgbr")
            },
            "clean_features_17_no_leak": {
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_A, clean_features], y_train, df_after.loc[test_mask_A, clean_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_A, clean_features], y_train, df_after.loc[test_mask_A, clean_features], y_test, "hgbr")
            }
        }
    results["regime_A_original_split"] = regime_A_res

    # --------------------------------------------------------------------------
    # 3. Regime B: Corridor-Held-Out Evaluation (Unseen Corridors)
    # --------------------------------------------------------------------------
    print("\n[3. Regime B: Corridor-Held-Out Evaluation]")
    held_out_corridors = ["Silk Board Junction", "Hosur Road", "ITPL Main Road", "Tumkur Road"]
    test_mask_B = df_before["Road/Intersection Name"].isin(held_out_corridors)
    train_mask_B = ~test_mask_B

    regime_B_res = {
        "train_rows": int(train_mask_B.sum()),
        "test_rows": int(test_mask_B.sum()),
        "train_corridors_count": int(df_before.loc[train_mask_B, "Road/Intersection Name"].nunique()),
        "test_corridors": held_out_corridors,
        "targets": {}
    }

    for target in target_cols:
        y_train = df_after.loc[train_mask_B, target]
        y_test = df_after.loc[test_mask_B, target]

        regime_B_res["targets"][target] = {
            "target_mean": round(float(y_train.mean()), 2),
            "target_std": round(float(y_train.std()), 2),
            "all_features_23": {
                "dummy_baseline": fit_and_evaluate(df_after.loc[train_mask_B, all_features], y_train, df_after.loc[test_mask_B, all_features], y_test, "dummy"),
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_B, all_features], y_train, df_after.loc[test_mask_B, all_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_B, all_features], y_train, df_after.loc[test_mask_B, all_features], y_test, "hgbr")
            },
            "clean_features_17_no_leak": {
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_B, clean_features], y_train, df_after.loc[test_mask_B, clean_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_B, clean_features], y_train, df_after.loc[test_mask_B, clean_features], y_test, "hgbr")
            }
        }
    results["regime_B_corridor_held_out"] = regime_B_res

    # --------------------------------------------------------------------------
    # 4. Regime C: Chronological Evaluation (Future Dates Holdout)
    # --------------------------------------------------------------------------
    print("\n[4. Regime C: Chronological Evaluation (Train <= 2023, Test >= 2024)]")
    split_date = "2024-01-01"
    train_mask_C = df_before["Date"] < split_date
    test_mask_C = df_before["Date"] >= split_date

    regime_C_res = {
        "train_rows": int(train_mask_C.sum()),
        "test_rows": int(test_mask_C.sum()),
        "train_date_range": [str(df_before.loc[train_mask_C, "Date"].min()), str(df_before.loc[train_mask_C, "Date"].max())],
        "test_date_range": [str(df_before.loc[test_mask_C, "Date"].min()), str(df_before.loc[test_mask_C, "Date"].max())],
        "targets": {}
    }

    for target in target_cols:
        y_train = df_after.loc[train_mask_C, target]
        y_test = df_after.loc[test_mask_C, target]

        regime_C_res["targets"][target] = {
            "target_mean": round(float(y_train.mean()), 2),
            "target_std": round(float(y_train.std()), 2),
            "all_features_23": {
                "dummy_baseline": fit_and_evaluate(df_after.loc[train_mask_C, all_features], y_train, df_after.loc[test_mask_C, all_features], y_test, "dummy"),
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_C, all_features], y_train, df_after.loc[test_mask_C, all_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_C, all_features], y_train, df_after.loc[test_mask_C, all_features], y_test, "hgbr")
            },
            "clean_features_17_no_leak": {
                "ridge_baseline": fit_and_evaluate(df_after.loc[train_mask_C, clean_features], y_train, df_after.loc[test_mask_C, clean_features], y_test, "ridge"),
                "chunkflow_hgbr": fit_and_evaluate(df_after.loc[train_mask_C, clean_features], y_train, df_after.loc[test_mask_C, clean_features], y_test, "hgbr")
            }
        }
    results["regime_C_chronological_holdout"] = regime_C_res

    # Save to JSON
    with open(ROOT / "audit_evaluation_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved comprehensive evaluation to {ROOT / 'audit_evaluation_results.json'}")

    # Print Summary Table
    print("\n" + "="*80)
    print("  AUDIT & BENCHMARK SUMMARY TABLE (TEST SET METRICS)")
    print("="*80)
    for target in target_cols:
        print(f"\n--- TARGET: {target} ---")
        print(f"{'Regime & Configuration':<45} | {'R2':>8} | {'MAE':>10} | {'RMSE':>10}")
        print("-" * 80)
        
        # Regime A
        t_A = regime_A_res["targets"][target]
        print(f"{'Regime A (Random Split) - Dummy Baseline':<45} | {t_A['all_features_23']['dummy_baseline']['test']['R2']:>8.4f} | {t_A['all_features_23']['dummy_baseline']['test']['MAE']:>10.4f} | {t_A['all_features_23']['dummy_baseline']['test']['RMSE']:>10.4f}")
        print(f"{'Regime A (Random Split) - Ridge (All 23)':<45} | {t_A['all_features_23']['ridge_baseline']['test']['R2']:>8.4f} | {t_A['all_features_23']['ridge_baseline']['test']['MAE']:>10.4f} | {t_A['all_features_23']['ridge_baseline']['test']['RMSE']:>10.4f}")
        print(f"{'Regime A (Random Split) - HGBR (All 23)':<45} | {t_A['all_features_23']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_A['all_features_23']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_A['all_features_23']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")
        print(f"{'Regime A (Random Split) - HGBR (Clean 17)':<45} | {t_A['clean_features_17_no_leak']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_A['clean_features_17_no_leak']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_A['clean_features_17_no_leak']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")
        print("-" * 80)
        
        # Regime B
        t_B = regime_B_res["targets"][target]
        print(f"{'Regime B (Unseen Corridors) - Dummy Baseline':<45} | {t_B['all_features_23']['dummy_baseline']['test']['R2']:>8.4f} | {t_B['all_features_23']['dummy_baseline']['test']['MAE']:>10.4f} | {t_B['all_features_23']['dummy_baseline']['test']['RMSE']:>10.4f}")
        print(f"{'Regime B (Unseen Corridors) - HGBR (All 23)':<45} | {t_B['all_features_23']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_B['all_features_23']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_B['all_features_23']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")
        print(f"{'Regime B (Unseen Corridors) - HGBR (Clean 17)':<45} | {t_B['clean_features_17_no_leak']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_B['clean_features_17_no_leak']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_B['clean_features_17_no_leak']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")
        print("-" * 80)

        # Regime C
        t_C = regime_C_res["targets"][target]
        print(f"{'Regime C (Chronological 2024) - Dummy Baseline':<45} | {t_C['all_features_23']['dummy_baseline']['test']['R2']:>8.4f} | {t_C['all_features_23']['dummy_baseline']['test']['MAE']:>10.4f} | {t_C['all_features_23']['dummy_baseline']['test']['RMSE']:>10.4f}")
        print(f"{'Regime C (Chronological 2024) - HGBR (All 23)':<45} | {t_C['all_features_23']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_C['all_features_23']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_C['all_features_23']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")
        print(f"{'Regime C (Chronological 2024) - HGBR (Clean 17)':<45} | {t_C['clean_features_17_no_leak']['chunkflow_hgbr']['test']['R2']:>8.4f} | {t_C['clean_features_17_no_leak']['chunkflow_hgbr']['test']['MAE']:>10.4f} | {t_C['clean_features_17_no_leak']['chunkflow_hgbr']['test']['RMSE']:>10.4f}")

if __name__ == "__main__":
    audit()
