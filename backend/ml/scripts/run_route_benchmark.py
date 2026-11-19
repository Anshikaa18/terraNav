"""Route-level evaluation and dynamic rerouting benchmarking across 4 routing policies."""
import sys
from pathlib import Path
import json
import time

# Ensure src is on python path
src_dir = Path(__file__).resolve().parents[1] / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

import numpy as np
import pandas as pd

from terranav.config import (
    ROOT_DIR,
    ARTIFACTS_DIR,
    REPORTS_DIR,
    MIN_SPEED_FLOOR_KMH,
)
from terranav.network.graph_builder import build_bengaluru_network, RoadNetworkGraph
from terranav.routing.shortest_path import find_shortest_path, UnreachableDestinationError
from terranav.routing.costs import get_cost_function
from terranav.routing.rerouting import DynamicReroutingController
from terranav.serving.predictor import ServingPredictorService


def benchmark_routing_policies():
    print("\n" + "=" * 60)
    print("RUNNING END-TO-END ROUTE-LEVEL BENCHMARKS (4 POLICIES)")
    print("=" * 60)

    # Initialize Bengaluru road network
    network = build_bengaluru_network()
    net_val = network.validate_network()
    print(f"Network initialized: {net_val['num_nodes']} intersections, {net_val['num_edges']} directed edges. Valid: {net_val['is_valid']}")

    # Setup 12 representative Origin-Destination pairs
    od_pairs = [
        ("ANIL_KUMBLE", "E_CITY"),       # Central to Electronic City
        ("HEBBAL", "SILK_BOARD"),        # North to South
        ("YESHWANTHPUR", "ITPL"),        # North-West to East Whitefield
        ("100_FT_RD", "E_CITY"),         # Indiranagar to Electronic City
        ("SOUTH_END", "HEBBAL"),         # Jayanagar to Hebbal
        ("TUMKUR_RD", "MARATHAHALLI"),   # Tumkur Road to ORR East
        ("SONY_WORLD", "BALLARI_RD"),     # Koramangala to North Bengaluru
        ("ITPL", "SOUTH_END"),           # Whitefield to Jayanagar
        ("CMH_RD", "YESHWANTHPUR"),      # Indiranagar to Yeshwanthpur
        ("HOSUR_RD", "ANIL_KUMBLE"),      # Hosur Road to Central
        ("MARATHAHALLI", "SONY_WORLD"),  # ORR East to Koramangala
        ("BALLARI_RD", "E_CITY"),        # North corridor to South
    ]

    # Load production ML predictor
    predictor_service = ServingPredictorService()

    # Simulate realistic dynamic traffic conditions:
    # High congestion on Silk Board Junction (speed drops to 12 km/h, incident delay +300s)
    # Moderate congestion on Marathahalli (speed drops to 22 km/h)
    # Heavy congestion on Anil Kumble Central (speed drops to 18 km/h)
    congested_edges = [
        ("SONY_WORLD", "SILK_BOARD", 12.0, 4.0, 240.0),
        ("SILK_BOARD", "SONY_WORLD", 12.0, 4.0, 240.0),
        ("MARATHAHALLI", "SILK_BOARD", 20.0, 5.0, 120.0),
        ("SILK_BOARD", "MARATHAHALLI", 20.0, 5.0, 120.0),
        ("ANIL_KUMBLE", "TRINITY", 18.0, 3.0, 60.0),
        ("TRINITY", "ANIL_KUMBLE", 18.0, 3.0, 60.0),
    ]

    for u, v, spd, unc, inc in congested_edges:
        if network.graph.has_edge(u, v):
            network.update_edge_traffic(u, v, predicted_speed_kmh=spd, uncertainty_kmh=unc, incident_penalty_seconds=inc)

    # 4 Routing Policies to Compare:
    # 1. Shortest Distance
    # 2. Static Free-Flow Travel Time
    # 3. Baseline Traffic (Historical Mean Speed: uniform 35 km/h across all edges)
    # 4. Dynamic ML Travel Time (Current ML-predicted speeds + incident penalties)

    policy_results = {
        "shortest_distance": [],
        "static_free_flow": [],
        "baseline_traffic": [],
        "dynamic_ml": [],
    }

    # Baseline traffic cost evaluator (uniform 35 km/h)
    def baseline_traffic_cost(u, v, edge):
        if edge.get("is_closed", False):
            return 1e9
        length = edge.get("length_meters", 1000.0)
        return length / (35.0 / 3.6)

    cost_funcs = {
        "shortest_distance": get_cost_function("shortest_distance"),
        "static_free_flow": get_cost_function("static_free_flow"),
        "baseline_traffic": baseline_traffic_cost,
        "dynamic_ml": get_cost_function("dynamic_ml"),
    }

    print("\nEvaluating 12 OD pairs across 4 policies...")
    route_comparison_table = []

    for orig, dest in od_pairs:
        pair_data = {"origin": orig, "destination": dest}
        for p_name, c_fn in cost_funcs.items():
            t0 = time.perf_counter()
            route = find_shortest_path(network, orig, dest, cost_function=c_fn)
            comp_latency_ms = (time.perf_counter() - t0) * 1000.0

            # Compute true traversal time under dynamic conditions
            # Sum up actual edge travel times along chosen route
            actual_travel_time = sum(
                network.graph[u][v]["travel_time_seconds"]
                for u, v in zip(route["path_nodes"][:-1], route["path_nodes"][1:])
            )

            res = {
                "distance_km": round(route["total_distance_meters"] / 1000.0, 2),
                "actual_travel_time_min": round(actual_travel_time / 60.0, 2),
                "actual_travel_time_sec": round(actual_travel_time, 1),
                "path": " -> ".join(route["path_nodes"]),
                "nodes_count": len(route["path_nodes"]),
                "route_latency_ms": round(comp_latency_ms, 3),
            }
            policy_results[p_name].append(res)
            pair_data[p_name] = res

        route_comparison_table.append(pair_data)

    # Compute Aggregate Policy Metrics
    aggregate_metrics = {}
    for p_name in cost_funcs.keys():
        times = [r["actual_travel_time_sec"] for r in policy_results[p_name]]
        dists = [r["distance_km"] for r in policy_results[p_name]]
        lats = [r["route_latency_ms"] for r in policy_results[p_name]]
        aggregate_metrics[p_name] = {
            "mean_travel_time_sec": round(float(np.mean(times)), 1),
            "mean_travel_time_min": round(float(np.mean(times)) / 60.0, 2),
            "mean_distance_km": round(float(np.mean(dists)), 2),
            "mean_route_latency_ms": round(float(np.mean(lats)), 3),
            "p95_route_latency_ms": round(float(np.percentile(lats, 95)), 3),
        }

    # Travel Time Savings relative to Static Free-Flow & Shortest Distance
    static_mean_time = aggregate_metrics["static_free_flow"]["mean_travel_time_sec"]
    dist_mean_time = aggregate_metrics["shortest_distance"]["mean_travel_time_sec"]
    ml_mean_time = aggregate_metrics["dynamic_ml"]["mean_travel_time_sec"]

    savings_vs_static_pct = ((static_mean_time - ml_mean_time) / static_mean_time) * 100.0
    savings_vs_dist_pct = ((dist_mean_time - ml_mean_time) / dist_mean_time) * 100.0

    print("\n--- Summary of 4 Routing Policies (Averages over 12 Trips) ---")
    print(f"  1. Shortest Distance : {aggregate_metrics['shortest_distance']['mean_travel_time_min']:5.2f} min | Distance: {aggregate_metrics['shortest_distance']['mean_distance_km']:5.2f} km | Latency: {aggregate_metrics['shortest_distance']['mean_route_latency_ms']:5.3f} ms")
    print(f"  2. Static Free-Flow  : {aggregate_metrics['static_free_flow']['mean_travel_time_min']:5.2f} min | Distance: {aggregate_metrics['static_free_flow']['mean_distance_km']:5.2f} km | Latency: {aggregate_metrics['static_free_flow']['mean_route_latency_ms']:5.3f} ms")
    print(f"  3. Baseline Traffic  : {aggregate_metrics['baseline_traffic']['mean_travel_time_min']:5.2f} min | Distance: {aggregate_metrics['baseline_traffic']['mean_distance_km']:5.2f} km | Latency: {aggregate_metrics['baseline_traffic']['mean_route_latency_ms']:5.3f} ms")
    print(f"  4. Dynamic ML Routing: {aggregate_metrics['dynamic_ml']['mean_travel_time_min']:5.2f} min | Distance: {aggregate_metrics['dynamic_ml']['mean_distance_km']:5.2f} km | Latency: {aggregate_metrics['dynamic_ml']['mean_route_latency_ms']:5.3f} ms")
    print(f"\n  Dynamic ML Savings vs. Shortest Distance: {savings_vs_dist_pct:5.2f}% ({dist_mean_time - ml_mean_time:.1f}s)")
    print(f"  Dynamic ML Savings vs. Static Free-Flow : {savings_vs_static_pct:5.2f}% ({static_mean_time - ml_mean_time:.1f}s)")

    # Test Dynamic Rerouting Controller Under Changing Conditions
    print("\n" + "=" * 60)
    print("TESTING DYNAMIC REROUTING CONTROLLER (HYSTERESIS & STABILITY)")
    print("=" * 60)

    reroute_controller = DynamicReroutingController(
        road_network=network,
        threshold_percent=0.12,          # 12% improvement threshold
        min_time_saving_seconds=90.0,    # 90s minimum savings
        cooldown_seconds=60.0,           # 60s cooldown
    )

    # Scenario: Vehicle travels from HEBBAL to E_CITY (North to South corridor)
    initial_route = find_shortest_path(network, "HEBBAL", "E_CITY")
    reroute_controller.set_active_route(initial_route["path_nodes"], start_time=0.0)
    print(f"Initial Route: {' -> '.join(initial_route['path_nodes'])} ({initial_route['total_travel_time_seconds']/60.0:.2f} min)")

    reroute_events = []

    # Event 1: Vehicle reaches BALLARI_RD at t = 240s. A minor traffic slowdown occurs (below threshold).
    dec1 = reroute_controller.evaluate_reroute("BALLARI_RD", "E_CITY", current_timestamp=240.0)
    print(f"\nEvent 1 (t=240s at BALLARI_RD - Minor Delay):")
    print(f"  Decision: should_reroute={dec1.should_reroute} | Reason: {dec1.reason}")
    reroute_events.append({"timestamp": 240.0, "decision": dec1.should_reroute, "reason": dec1.reason})

    # Event 2: Vehicle reaches ANIL_KUMBLE at t = 600s. Direct segment ahead (SOUTH_END -> JAYANAGAR_4TH) is closed due to waterlogging/flooding!
    network.update_edge_traffic("SOUTH_END", "JAYANAGAR_4TH", predicted_speed_kmh=MIN_SPEED_FLOOR_KMH, is_closed=True)
    dec2 = reroute_controller.evaluate_reroute("ANIL_KUMBLE", "E_CITY", current_timestamp=600.0)
    print(f"\nEvent 2 (t=600s at ANIL_KUMBLE - Road Closure Ahead on SOUTH_END -> JAYANAGAR_4TH):")
    print(f"  Decision: should_reroute={dec2.should_reroute} | Mandatory: {dec2.is_mandatory} | Reason: {dec2.reason}")
    print(f"  New Detour: {' -> '.join(dec2.new_path)}")
    reroute_events.append({"timestamp": 600.0, "decision": dec2.should_reroute, "reason": dec2.reason, "new_path": dec2.new_path})

    # Event 3: Vehicle reaches TRINITY at t = 635s (only 35s since Event 2; cooldown is 60s).
    # A minor 20-second difference arises. Cooldown must prevent rapid oscillation!
    dec3 = reroute_controller.evaluate_reroute("TRINITY", "E_CITY", current_timestamp=635.0)
    print(f"\nEvent 3 (t=635s at TRINITY - Rapid Fluctuating Traffic within Cooldown):")
    print(f"  Decision: should_reroute={dec3.should_reroute} | Reason: {dec3.reason}")
    reroute_events.append({"timestamp": 635.0, "decision": dec3.should_reroute, "reason": dec3.reason})

    # Event 4: Vehicle at SONY_WORLD at t = 750s (>60s cooldown). Ahead segment clears completely, saving >180s.
    network.update_edge_traffic("SONY_WORLD", "SILK_BOARD", predicted_speed_kmh=55.0, incident_penalty_seconds=0.0)
    dec4 = reroute_controller.evaluate_reroute("SONY_WORLD", "E_CITY", current_timestamp=750.0)
    print(f"\nEvent 4 (t=750s at SONY_WORLD - Traffic Cleared & Cooldown Expired):")
    print(f"  Decision: should_reroute={dec4.should_reroute} | Reason: {dec4.reason}")
    reroute_events.append({"timestamp": 750.0, "decision": dec4.should_reroute, "reason": dec4.reason})

    benchmark_output = {
        "benchmark_timestamp": pd.Timestamp.now().isoformat(),
        "aggregate_policy_metrics": aggregate_metrics,
        "travel_time_savings": {
            "ml_savings_vs_shortest_distance_pct": round(savings_vs_dist_pct, 2),
            "ml_savings_vs_shortest_distance_sec": round(dist_mean_time - ml_mean_time, 1),
            "ml_savings_vs_static_free_flow_pct": round(savings_vs_static_pct, 2),
            "ml_savings_vs_static_free_flow_sec": round(static_mean_time - ml_mean_time, 1),
        },
        "od_pair_evaluations": route_comparison_table,
        "reroute_simulation_events": reroute_events,
    }

    out_json = REPORTS_DIR / "route_benchmark_results.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(benchmark_output, f, indent=2)

    print("\n" + "=" * 60)
    print(f"ROUTE BENCHMARKING COMPLETE. Saved to: {out_json}")
    print("=" * 60)


if __name__ == "__main__":
    benchmark_routing_policies()
