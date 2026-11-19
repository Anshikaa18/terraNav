"""Unit tests for directed road network graph and shortest path algorithms."""
import unittest
from terranav.network.graph_builder import RoadNetworkGraph, build_bengaluru_network
from terranav.routing.shortest_path import find_shortest_path, UnreachableDestinationError
from terranav.routing.costs import get_cost_function


class TestNetworkAndRouting(unittest.TestCase):
    def setUp(self):
        self.network = build_bengaluru_network()

    def test_network_validity(self):
        val = self.network.validate_network()
        self.assertTrue(val["is_valid"])
        self.assertEqual(val["num_nodes"], 16)
        self.assertGreater(val["num_edges"], 40)
        self.assertEqual(val["self_loops_count"], 0)
        self.assertEqual(val["invalid_length_edges_count"], 0)

    def test_dijkstra_vs_astar_equivalence(self):
        # A* and Dijkstra must return the exact same optimal travel time and path on standard graph
        dijk_route = find_shortest_path(self.network, "ANIL_KUMBLE", "E_CITY", algorithm="dijkstra")
        astar_route = find_shortest_path(self.network, "ANIL_KUMBLE", "E_CITY", algorithm="astar")

        self.assertEqual(dijk_route["path_nodes"], astar_route["path_nodes"])
        self.assertAlmostEqual(dijk_route["total_travel_time_seconds"], astar_route["total_travel_time_seconds"], places=1)
        self.assertAlmostEqual(dijk_route["total_distance_meters"], astar_route["total_distance_meters"], places=1)

    def test_unreachable_destination_raises(self):
        # Create an isolated node
        self.network.add_intersection("ISOLATED_NODE", lat=12.9000, lon=77.5000)
        with self.assertRaises(UnreachableDestinationError):
            find_shortest_path(self.network, "ANIL_KUMBLE", "ISOLATED_NODE")

    def test_closure_avoidance(self):
        # Check initial path
        initial = find_shortest_path(self.network, "TRINITY", "MARATHAHALLI")
        self.assertIn("100_FT_RD", initial["path_nodes"])

        # Close the segment TRINITY -> 100_FT_RD
        self.network.update_edge_traffic("TRINITY", "100_FT_RD", predicted_speed_kmh=5.0, is_closed=True)

        # Re-route should automatically detour around via CMH_RD
        detour = find_shortest_path(self.network, "TRINITY", "MARATHAHALLI")
        self.assertIn("CMH_RD", detour["path_nodes"])
        self.assertNotIn(("TRINITY", "100_FT_RD"), list(zip(detour["path_nodes"][:-1], detour["path_nodes"][1:])))

    def test_shortest_distance_vs_dynamic_ml_policy(self):
        # Make a short road heavily congested (speed drops to 5 km/h, 10 min incident delay)
        # SONY_WORLD -> SILK_BOARD
        self.network.update_edge_traffic("SONY_WORLD", "SILK_BOARD", predicted_speed_kmh=5.0, incident_penalty_seconds=600.0)

        dist_fn = get_cost_function("shortest_distance")
        ml_fn = get_cost_function("dynamic_ml")

        dist_route = find_shortest_path(self.network, "SONY_WORLD", "E_CITY", cost_function=dist_fn)
        ml_route = find_shortest_path(self.network, "SONY_WORLD", "E_CITY", cost_function=ml_fn)

        # Shortest distance still picks the short congested edge
        self.assertIn("SILK_BOARD", dist_route["path_nodes"])
        # Dynamic ML routing avoids the heavy incident delay
        self.assertLess(ml_route["total_travel_time_seconds"], dist_route["total_travel_time_seconds"])


if __name__ == "__main__":
    unittest.main()
