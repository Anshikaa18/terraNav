"""End-to-end pipeline test: traffic snapshot -> ML prediction -> graph routing -> dynamic rerouting."""
import unittest
from datetime import datetime, timezone
from terranav.network.graph_builder import build_bengaluru_network
from terranav.serving.api import handle_route_request, handle_update_traffic
from terranav.serving.predictor import ServingPredictorService


class TestEndToEndPipeline(unittest.TestCase):
    def setUp(self):
        self.network = build_bengaluru_network()
        self.serving_service = ServingPredictorService()

    def test_offline_model_inference_does_not_claim_live_routing(self):
        # Schema-complete fixture for model loading/inference only. The source
        # dataset contains synthetic targets, so this is not live traffic evidence.
        base_features = {
                "length_meters": 450.0,
                "x_Estimated Chunk Traffic Volume (synthetic)": 0.5,
                "x_Estimated Queue Length (m; synthetic)": 1.2,
                "x_Estimated Signal Delay (sec; synthetic)": 0.8,
                "x_Estimated Incident Delay (sec; synthetic)": 0.0,
                "x_Estimated Roadwork Delay (sec; synthetic)": 0.0,
                "x_Chunk Length (m)": 0.2,
                "x_Road Capacity Utilization": 1.5,  # High utilization
                "x_Traffic Signal Present_Yes": 1.0,
                "x_Roadwork in Chunk_Yes": 0.0,
                "x_Weather Conditions_Fog": 0.0,
                "x_Weather Conditions_Overcast": 0.0,
                "x_Weather Conditions_Rain": 0.0,
                "x_Weather Conditions_Windy": 0.0,
                "x_Chunk Sequence_2": 1.0,
                "x_Chunk Sequence_3": 0.0,
                "x_Chunk Sequence_4": 0.0,
                "x_Chunk Sequence_5": 0.0,
            }

        resp = self.serving_service.predict_segments([base_features])
        self.assertTrue(resp["ok"])
        self.assertEqual(len(resp["predictions"]), 1)

        pred1 = resp["predictions"][0]
        self.assertGreater(pred1["predicted_speed_kmh"], 5.0)
        self.assertGreater(pred1["predicted_travel_time_sec"], 0.0)
        self.assertGreater(pred1["travel_time_upper_90_sec"], pred1["travel_time_lower_90_sec"])

        self.assertIsNotNone(pred1["predicted_speed_kmh"])
        self.assertGreater(pred1["predicted_travel_time_sec"], 0.0)

        incomplete = self.serving_service.predict_segments([{"length_meters": 450.0}])
        self.assertFalse(incomplete["ok"])
        self.assertIn("missing trained feature columns", incomplete["error"])

    def test_live_ml_graph_route_is_explicitly_unavailable(self):
        result = handle_route_request(self.network, {
            "origin": "Sony World Junction",
            "destination": "Electronic City",
        })
        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], "LIVE_ML_ROUTING_UNAVAILABLE")
        self.assertFalse(result["model_predictions_influenced_route"])

    def test_research_graph_route_discloses_static_connector_geometry(self):
        result = handle_route_request(self.network, {
            "origin": "Sony World Junction",
            "destination": "Electronic City",
            "strategy": "research_static",
        })
        self.assertTrue(result["ok"])
        self.assertFalse(result["is_ml_optimized"])
        self.assertEqual(result["geometry_quality"], "intersection_connectors_not_road_geometry")

    def test_traffic_updates_require_fresh_observed_values_and_provenance(self):
        inferred_only = handle_update_traffic(self.network, {"updates": [{
            "u": "TRINITY", "v": "SONY_WORLD", "predicted_speed_kmh": 42
        }]})
        self.assertFalse(inferred_only["ok"])
        self.assertEqual(inferred_only["updated_edges"], 0)

        observation = {
            "u": "TRINITY", "v": "SONY_WORLD", "speed_kmh": 27,
            "source": "test-provider-fixture",
            "observed_at": datetime.now(timezone.utc).isoformat(),
        }
        applied = handle_update_traffic(self.network, {"updates": [observation]})
        self.assertTrue(applied["ok"])
        self.assertEqual(applied["updated_edges"], 1)
        self.assertEqual(self.network.graph["TRINITY"]["SONY_WORLD"]["current_speed_kmh"], 27)

        stale = {**observation, "observed_at": "2020-01-01T00:00:00+00:00"}
        rejected = handle_update_traffic(self.network, {"updates": [stale]})
        self.assertFalse(rejected["ok"])
        self.assertEqual(rejected["updated_edges"], 0)


if __name__ == "__main__":
    unittest.main()
