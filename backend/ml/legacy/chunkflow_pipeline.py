"""
ChunkFlow feature-preparation and prediction pipeline.
Input: rows from ChunkFlow Phase-2 schema.
Output: clean, model-ready feature DataFrame and two predictions.
"""
from pathlib import Path

import numpy as np
import pandas as pd

import compat
import joblib

BUNDLE_PATH = Path(__file__).with_name("ChunkFlow_Trained_Models_and_Preprocessing.joblib")
BUNDLE = joblib.load(BUNDLE_PATH)
FEATURE_COLUMNS = BUNDLE["feature_columns"]
TARGET_COLUMNS = BUNDLE["target_columns"]
PARAMS = BUNDLE["transform_params"]
FEATURE_SCHEMA_VERSION = BUNDLE.get("feature_schema_version", "legacy")
MODEL_VERSION = BUNDLE.get("model_version", "unknown")

if any(name.startswith("x_LEAK_") for name in FEATURE_COLUMNS):
    raise ValueError(
        "Model bundle contains leakage features (x_LEAK_*). Rebuild with build_bundle.py."
    )

if FEATURE_SCHEMA_VERSION != "clean-17-v1":
    raise ValueError(
        f"Unexpected feature_schema_version '{FEATURE_SCHEMA_VERSION}'. Expected clean-17-v1."
    )


def _scaled_numeric(df, feature_name, values, transform=None):
    if not isinstance(values, pd.Series):
        values = pd.Series(values, index=df.index)
    values = pd.to_numeric(values, errors="coerce")
    p = PARAMS[feature_name]
    if transform == "log1p":
        values = np.where(values < 0, 0, values)
        values = np.log1p(values)
    return (values - p["mean"]) / p["scale"]


def prepare_features(raw_df):
    """Transform raw Phase-2 columns into the canonical 17-column clean schema."""
    df = raw_df.copy()
    out = pd.DataFrame(index=df.index)

    for feature, source in [
        ("x_Estimated Chunk Traffic Volume (synthetic)", "Estimated Chunk Traffic Volume (synthetic)"),
        ("x_Estimated Queue Length (m; synthetic)", "Estimated Queue Length (m; synthetic)"),
        ("x_Estimated Signal Delay (sec; synthetic)", "Estimated Signal Delay (sec; synthetic)"),
        ("x_Estimated Incident Delay (sec; synthetic)", "Estimated Incident Delay (sec; synthetic)"),
        ("x_Estimated Roadwork Delay (sec; synthetic)", "Estimated Roadwork Delay (sec; synthetic)"),
    ]:
        val = df[source] if source in df.columns else pd.Series([np.nan] * len(df), index=df.index)
        out[feature] = _scaled_numeric(df, feature, val, "log1p")

    for feature, source in [
        ("x_Chunk Length (m)", "Chunk Length (m)"),
        ("x_Road Capacity Utilization", "Road Capacity Utilization"),
    ]:
        val = df[source] if source in df.columns else pd.Series([np.nan] * len(df), index=df.index)
        out[feature] = _scaled_numeric(df, feature, val)

    sig_src = df["Traffic Signal Present"] if "Traffic Signal Present" in df.columns else pd.Series(["No"] * len(df), index=df.index)
    out["x_Traffic Signal Present_Yes"] = sig_src.astype(str).str.strip().str.lower().eq("yes").astype(float)

    rw_chunk_src = df["Roadwork in Chunk"] if "Roadwork in Chunk" in df.columns else pd.Series(["No"] * len(df), index=df.index)
    out["x_Roadwork in Chunk_Yes"] = rw_chunk_src.astype(str).str.strip().str.lower().eq("yes").astype(float)

    weather_src = df["Weather Conditions"] if "Weather Conditions" in df.columns else pd.Series(["Clear"] * len(df), index=df.index)
    for weather in ["Fog", "Overcast", "Rain", "Windy"]:
        out[f"x_Weather Conditions_{weather}"] = weather_src.astype(str).str.strip().str.lower().eq(weather.lower()).astype(float)

    seq_src = df["Chunk Sequence"] if "Chunk Sequence" in df.columns else pd.Series([1] * len(df), index=df.index)
    for seq in [2, 3, 4, 5]:
        out[f"x_Chunk Sequence_{seq}"] = pd.to_numeric(seq_src, errors="coerce").eq(seq).astype(float)

    out = out[FEATURE_COLUMNS]
    if np.isinf(out.to_numpy(dtype=float)).any():
        raise ValueError("Prepared features contain infinite values.")
    return out


def predict(raw_df):
    """Return a DataFrame with one prediction column per target."""
    X = prepare_features(raw_df)
    result = pd.DataFrame(index=raw_df.index)
    for target in TARGET_COLUMNS:
        result[target + " — prediction"] = BUNDLE["models"][target].predict(X)
    return result


if __name__ == "__main__":
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("input_csv", help="Path to Phase-2 processed input CSV")
    parser.add_argument("--output", default="ChunkFlow_predictions.csv")
    args = parser.parse_args()
    source = pd.read_csv(args.input_csv)
    predictions = predict(source)
    predictions.to_csv(args.output, index=False)
    print(f"Saved predictions to {args.output}")
