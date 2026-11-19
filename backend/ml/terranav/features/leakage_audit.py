"""Automated leakage audits, correlation screening, and train/test contamination checks."""
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from scipy.stats import pearsonr, spearmanr


def audit_feature_correlations(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_col: str,
    leakage_threshold: float = 0.80,
) -> Dict[str, Any]:
    """
    Compute Pearson and Spearman correlations between candidate features and the target.

    Flags features with absolute Pearson correlation >= leakage_threshold as
    potential target leakage vectors.
    """
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not present in DataFrame")

    target = pd.to_numeric(df[target_col], errors="coerce").dropna()
    results = {}
    flagged = []

    for col in feature_cols:
        if col not in df.columns:
            continue
        feat = pd.to_numeric(df[col], errors="coerce")
        valid_idx = target.index.intersection(feat.dropna().index)
        if len(valid_idx) < 10:
            continue

        x_vals = feat.loc[valid_idx].to_numpy()
        y_vals = target.loc[valid_idx].to_numpy()

        # Handle zero variance
        if np.std(x_vals) == 0 or np.std(y_vals) == 0:
            p_corr, s_corr = 0.0, 0.0
        else:
            p_corr, _ = pearsonr(x_vals, y_vals)
            s_corr, _ = spearmanr(x_vals, y_vals)

        is_suspicious = abs(p_corr) >= leakage_threshold or "LEAK" in col
        res = {
            "feature": col,
            "pearson_r": float(p_corr),
            "spearman_rho": float(s_corr),
            "flagged_leakage": bool(is_suspicious),
        }
        results[col] = res
        if is_suspicious:
            flagged.append(col)

    return {
        "target": target_col,
        "n_samples": int(len(target)),
        "threshold": leakage_threshold,
        "flagged_features": flagged,
        "feature_metrics": results,
    }


def audit_train_test_contamination(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    group_col: str,
) -> Dict[str, Any]:
    """Check for identifier or entity contamination between train and test splits."""
    train_entities = set(train_df[group_col].dropna().unique())
    test_entities = set(test_df[group_col].dropna().unique())
    overlap = train_entities.intersection(test_entities)

    return {
        "group_column": group_col,
        "train_unique_count": len(train_entities),
        "test_unique_count": len(test_entities),
        "overlapping_count": len(overlap),
        "overlapping_entities": sorted(list(overlap))[:20],
        "is_contaminated": len(overlap) > 0,
    }
