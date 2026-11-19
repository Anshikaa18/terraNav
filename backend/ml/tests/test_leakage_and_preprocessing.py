"""Unit tests for leakage detection, chronological splitting, and cross-boundary purging."""
import unittest
import numpy as np
import pandas as pd
from terranav.data.preprocessing import (
    create_chronological_split,
    create_corridor_holdout_split,
    create_trajectory_chronological_split,
    LeakageFreePreprocessor,
)
from terranav.features.leakage_audit import (
    audit_feature_correlations,
    audit_train_test_contamination,
)


class TestLeakageAndPreprocessing(unittest.TestCase):
    def test_trajectory_purging(self):
        # Fixture with 3 synthetic tracks
        # Track 1: fully within train (t=0 to 10)
        # Track 2: crosses boundary (t=50 to 80)
        # Track 3: fully within test (t=90 to 100)
        data = {
            "Vehicle No.": [1, 1, 1, 2, 2, 2, 3, 3, 3],
            "Time (s)": [0.0, 5.0, 10.0, 50.0, 65.0, 80.0, 90.0, 95.0, 100.0],
            "longitudinal speed": [10.0] * 9,
            "vehicle type": [4] * 9,
            "logitudinal": [100.0] * 9,
            "lateral": [3.0] * 9,
            "longitudinal accleration": [0.0] * 9,
            "lateral velocity": [0.0] * 9,
            "lateral acceleration": [0.0] * 9,
        }
        df = pd.DataFrame(data)
        split_df = create_trajectory_chronological_split(df, train_fraction=0.6, val_fraction=0.2)

        # Max time is 100. Train limit = 60, val limit = 80.
        # Track 1 max is 10 <= 60 -> train
        # Track 2 crosses 60 (spans 50 to 80) -> purged
        # Track 3 min is 90 > 80 -> test
        track1_split = split_df[split_df["Vehicle No."] == 1]["split"].unique()
        track2_split = split_df[split_df["Vehicle No."] == 2]["split"].unique()
        track3_split = split_df[split_df["Vehicle No."] == 3]["split"].unique()

        self.assertEqual(list(track1_split), ["train"])
        self.assertEqual(list(track2_split), ["purged"])
        self.assertEqual(list(track3_split), ["test"])

        # Contamination check: Zero tracks in train should appear in test
        train_tracks = set(split_df[split_df["split"] == "train"]["Vehicle No."])
        test_tracks = set(split_df[split_df["split"] == "test"]["Vehicle No."])
        self.assertEqual(len(train_tracks.intersection(test_tracks)), 0)

    def test_chronological_tabular_split(self):
        dates = pd.date_range("2023-12-25", periods=10, freq="D")
        df = pd.DataFrame({"Date": dates, "val": range(10)})
        train, test = create_chronological_split(df, date_column="Date", split_date="2024-01-01")

        self.assertTrue((train["Date"] < pd.to_datetime("2024-01-01")).all())
        self.assertTrue((test["Date"] >= pd.to_datetime("2024-01-01")).all())
        self.assertEqual(len(train) + len(test), 10)

    def test_leakage_correlation_scanner(self):
        np.random.seed(42)
        n = 100
        target = np.random.normal(40.0, 10.0, n)
        # Create a synthetic target leak (r ~ 0.99)
        leaky_feature = target + np.random.normal(0.0, 0.5, n)
        clean_feature = np.random.normal(200.0, 50.0, n)

        df = pd.DataFrame({
            "target": target,
            "x_LEAK_direct": leaky_feature,
            "x_clean_feature": clean_feature,
        })

        audit = audit_feature_correlations(
            df=df,
            feature_cols=["x_LEAK_direct", "x_clean_feature"],
            target_col="target",
            leakage_threshold=0.80,
        )

        self.assertIn("x_LEAK_direct", audit["flagged_features"])
        self.assertNotIn("x_clean_feature", audit["flagged_features"])
        self.assertGreater(abs(audit["feature_metrics"]["x_LEAK_direct"]["pearson_r"]), 0.95)

    def test_preprocessor_train_only_fit(self):
        train_df = pd.DataFrame({"feat1": [10.0, 20.0, 30.0], "feat2": [1.0, 2.0, 3.0]})
        test_df = pd.DataFrame({"feat1": [100.0, 200.0], "feat2": [10.0, 20.0]})

        prep = LeakageFreePreprocessor(feature_cols=["feat1", "feat2"])
        X_train = prep.fit_transform(train_df)

        # Scaler must have means from train_df: feat1 mean = 20.0, feat2 mean = 2.0
        np.testing.assert_almost_equal(prep.scaler.mean_, np.array([20.0, 2.0]))

        # Transforming test must use training parameters, not test parameters
        X_test = prep.transform(test_df)
        self.assertEqual(X_test.shape, (2, 2))


if __name__ == "__main__":
    unittest.main()
