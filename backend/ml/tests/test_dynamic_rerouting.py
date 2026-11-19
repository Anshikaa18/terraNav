"""Unit tests for the dynamic rerouting controller, hysteresis, and stability controls."""
import unittest
from terranav.network.graph_builder import build_bengaluru_network
from terranav.routing.shortest_path import find_shortest_path
from terranav.routing.rerouting import DynamicReroutingController


class TestDynamicRerouting(unittest.TestCase):
    def setUp(self):
        self.network = build_bengaluru_network()
        self.controller = DynamicReroutingController(
            road_network=self.network,
            threshold_percent=0.12,          # 12% improvement required
            min_time_saving_seconds=90.0,    # 90s minimum saving
            cooldown_seconds=60.0,           # 60s cooldown
        )

    def test_mandatory_reroute_on_closure(self):
        # Initial route from HEBBAL to E_CITY
        initial = find_shortest_path(self.network, "HEBBAL", "E_CITY")
        self.controller.set_active_route(initial["path_nodes"], start_time=0.0)

        # Vehicle is at BALLARI_RD; close segment BALLARI_RD -> ANIL_KUMBLE
        self.network.update_edge_traffic("BALLARI_RD", "ANIL_KUMBLE", predicted_speed_kmh=5.0, is_closed=True)

        dec = self.controller.evaluate_reroute("BALLARI_RD", "E_CITY", current_timestamp=100.0)
        self.assertTrue(dec.should_reroute)
        self.assertTrue(dec.is_mandatory)
        self.assertIn("MANDATORY", dec.reason)
        # Detour must not traverse closed segment
        self.assertNotIn(("BALLARI_RD", "ANIL_KUMBLE"), list(zip(dec.new_path[:-1], dec.new_path[1:])))

    def test_cooldown_blocks_rapid_oscillation(self):
        initial = find_shortest_path(self.network, "TRINITY", "E_CITY")
        self.controller.set_active_route(initial["path_nodes"], start_time=0.0)

        # Trigger first reroute at t = 100s via road closure
        self.network.update_edge_traffic("SONY_WORLD", "SILK_BOARD", predicted_speed_kmh=5.0, is_closed=True)
        dec1 = self.controller.evaluate_reroute("TRINITY", "E_CITY", current_timestamp=100.0)
        self.assertTrue(dec1.should_reroute)

        # Reopen road at t = 120s (only 20s later; cooldown is 60s)
        self.network.update_edge_traffic("SONY_WORLD", "SILK_BOARD", predicted_speed_kmh=50.0, is_closed=False)
        dec2 = self.controller.evaluate_reroute("TRINITY", "E_CITY", current_timestamp=120.0)

        # Cooldown must reject the switch back to prevent rapid oscillation
        self.assertFalse(dec2.should_reroute)
        self.assertIn("COOLDOWN_ACTIVE", dec2.reason)

    def test_threshold_blocks_marginal_improvements(self):
        initial = find_shortest_path(self.network, "BALLARI_RD", "MARATHAHALLI")
        self.controller.set_active_route(initial["path_nodes"], start_time=0.0)

        # Create tiny 15-second difference (below 90s min saving)
        dec = self.controller.evaluate_reroute("BALLARI_RD", "MARATHAHALLI", current_timestamp=150.0)
        # Should stay on current path
        self.assertFalse(dec.should_reroute)


if __name__ == "__main__":
    unittest.main()
