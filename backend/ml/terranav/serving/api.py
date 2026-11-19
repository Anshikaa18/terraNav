"""Callable inference interface and daemon runner for live traffic consumption and dynamic graph routing."""
import sys
import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from terranav.config import ARTIFACTS_DIR, MIN_SPEED_FLOOR_KMH
from terranav.serving.predictor import ServingPredictorService
from terranav.network.graph_builder import build_bengaluru_network, RoadNetworkGraph
from terranav.routing.shortest_path import find_shortest_path, UnreachableDestinationError
from terranav.routing.rerouting import DynamicReroutingController
from terranav.routing.costs import dynamic_traffic_cost, distance_cost, static_travel_time_cost, get_cost_function


def resolve_node(network: RoadNetworkGraph, endpoint: Any) -> Optional[str]:
    """Resolve a node identifier from string ID, name, area, or lat/lng dictionary."""
    if isinstance(endpoint, str):
        clean = endpoint.strip().replace(" ", "_").upper()
        if clean in network.graph:
            return clean
        raw_clean = endpoint.strip().lower()
        # Direct match or case-insensitive name/area match
        for node_id, data in network.graph.nodes(data=True):
            if (
                node_id.lower() == raw_clean
                or node_id.replace("_", " ").lower() == raw_clean
                or data.get("name", "").lower() == raw_clean
            ):
                return node_id
        return None

    if isinstance(endpoint, dict):
        lat = endpoint.get("lat", endpoint.get("latitude"))
        lng = endpoint.get("lng", endpoint.get("lon", endpoint.get("longitude")))
        if lat is not None and lng is not None:
            try:
                node_id, _ = network.find_nearest_node(float(lat), float(lng), max_distance_meters=1000.0)
                return node_id
            except (TypeError, ValueError):
                return None

    return None


def handle_route_request(network: RoadNetworkGraph, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute dynamic route calculation on the directed road network."""
    origin_raw = payload.get("origin")
    dest_raw = payload.get("destination")
    algorithm = payload.get("algorithm", "astar").lower()
    strategy = payload.get("strategy", "ml_dynamic").lower()

    if strategy in ("ml_dynamic", "dynamic_ml"):
        return {
            "ok": False,
            "code": "LIVE_ML_ROUTING_UNAVAILABLE",
            "error": "The bundled segment model uses synthetic training targets and this graph has no validated live feature feed. No ML route was calculated.",
            "routing_strategy": None,
            "is_ml_optimized": False,
            "model_predictions_influenced_route": False,
        }
    if strategy not in ("research_static", "shortest_distance", "distance", "free_flow", "static_free_flow"):
        return {"ok": False, "code": "INVALID_STRATEGY", "error": f"Unsupported routing strategy: {strategy}"}
    if algorithm not in ("astar", "dijkstra"):
        return {"ok": False, "code": "INVALID_ALGORITHM", "error": f"Unsupported path algorithm: {algorithm}"}

    origin_node = resolve_node(network, origin_raw)
    dest_node = resolve_node(network, dest_raw)

    if not origin_node or not dest_node:
        return {
            "ok": False,
            "code": "OUT_OF_COVERAGE",
            "error": "Origin or destination falls outside Bengaluru arterial corridor coverage.",
            "origin_resolved": origin_node,
            "destination_resolved": dest_node,
        }

    cost_fn = static_travel_time_cost
    if strategy in ("shortest_distance", "distance"):
        cost_fn = distance_cost
    elif strategy in ("free_flow", "static_free_flow"):
        cost_fn = static_travel_time_cost

    try:
        route_result = find_shortest_path(network, origin_node, dest_node, cost_function=cost_fn, algorithm=algorithm)
        coords = network.get_route_coordinates(route_result["path_nodes"])
        return {
            "ok": True,
            "routing_strategy": f"terranav-research-{strategy}-{algorithm}",
            "is_ml_optimized": False,
            "model_predictions_influenced_route": False,
            "geometry_quality": "intersection_connectors_not_road_geometry",
            "data_provenance": "offline_corridor_graph_static_costs",
            "origin_node": origin_node,
            "destination_node": dest_node,
            "coordinates": coords,
            **route_result,
        }
    except UnreachableDestinationError as exc:
        return {
            "ok": False,
            "code": "UNREACHABLE_DESTINATION",
            "error": str(exc),
            "origin_node": origin_node,
            "destination_node": dest_node,
        }


def handle_reroute_request(controller: DynamicReroutingController, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate dynamic rerouting policy against current active trip."""
    network = controller.road_network
    current_raw = payload.get("current_node") or payload.get("origin")
    dest_raw = payload.get("destination")
    current_timestamp = float(payload.get("current_timestamp", time.time()))

    current_node = resolve_node(network, current_raw)
    dest_node = resolve_node(network, dest_raw)

    if not current_node or not dest_node:
        return {
            "ok": False,
            "code": "OUT_OF_COVERAGE",
            "error": "Current location or destination is outside supported network nodes.",
        }
    if not controller.active_route_nodes or controller.active_route_nodes[-1] != dest_node:
        return {
            "ok": False,
            "code": "ACTIVE_ROUTE_REQUIRED",
            "error": "Rerouting requires an active route created for this trip.",
        }

    decision = controller.evaluate_reroute(current_node, dest_node, current_timestamp)
    new_coords = network.get_route_coordinates(decision.new_path) if decision.new_path else []

    return {
        "ok": True,
        "should_reroute": decision.should_reroute,
        "reason": decision.reason,
        "is_mandatory": decision.is_mandatory,
        "current_remaining_time_sec": decision.current_remaining_time_sec,
        "new_route_time_sec": decision.new_route_time_sec,
        "time_saved_sec": decision.time_saved_sec,
        "improvement_percent": decision.improvement_percent,
        "current_path": decision.current_path,
        "new_path": decision.new_path,
        "new_coordinates": new_coords,
        "geometry_quality": "intersection_connectors_not_road_geometry",
        "data_provenance": "offline_corridor_graph_static_costs",
        "evaluation_time_sec": decision.evaluation_time_sec,
    }


def handle_update_traffic(network: RoadNetworkGraph, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update dynamic edge costs based on real-time observations or closures."""
    updates = payload.get("updates", [])
    updated_count = 0
    errors = []

    for item in updates:
        if not isinstance(item, dict):
            errors.append("Rejected traffic update: each item must be an object.")
            continue
        u = item.get("u") or item.get("from")
        v = item.get("v") or item.get("to")
        is_closed_value = item.get("is_closed", False)
        speed_value = item.get("speed_kmh")
        source = item.get("source")
        observed_at = item.get("observed_at")

        try:
            if not isinstance(is_closed_value, bool) or not source or not observed_at:
                raise ValueError("source and ISO observation timestamp are required")
            observed_time = datetime.fromisoformat(str(observed_at).replace("Z", "+00:00"))
            if observed_time.tzinfo is None:
                raise ValueError("observation timestamp must include a timezone")
            age_seconds = time.time() - observed_time.timestamp()
            if age_seconds < -300:
                raise ValueError("observation timestamp is more than five minutes in the future")
            age_seconds = max(0.0, age_seconds)
            if age_seconds > 900:
                raise ValueError("observation is stale (older than 15 minutes)")
            if is_closed_value:
                speed = MIN_SPEED_FLOOR_KMH
            else:
                if speed_value is None:
                    raise ValueError("an observed speed is required unless the edge is closed")
                speed = float(speed_value)
                if not MIN_SPEED_FLOOR_KMH <= speed <= 130.0:
                    raise ValueError("observed speed must be between 5 and 130 km/h")
            uncertainty = float(item.get("uncertainty_kmh", 0.0))
            penalty = float(item.get("incident_penalty_seconds", 0.0))
            if uncertainty < 0 or penalty < 0:
                raise ValueError("uncertainty and incident penalty must not be negative")
            network.update_edge_traffic(
                u=u, v=v,
                predicted_speed_kmh=speed,
                uncertainty_kmh=uncertainty,
                incident_penalty_seconds=penalty,
                is_closed=is_closed_value,
                freshness_seconds=age_seconds,
            )
            network.graph[u][v]["traffic_source"] = str(source)
            network.graph[u][v]["observed_at"] = observed_time.isoformat()
            updated_count += 1
        except Exception as e:
            errors.append(f"Rejected edge ({u}->{v}): {e}")

    return {
        "ok": len(errors) == 0,
        "updated_edges": updated_count,
        "errors": errors,
    }


def run_daemon():
    """Persistent stdin/stdout daemon for sub-15ms batch serving and dynamic graph routing."""
    service = ServingPredictorService()
    network = build_bengaluru_network()
    active_trip_controllers = {}

    sys.stdout.write(json.dumps({
        "ready": True,
        "ok": True,
        "modelVersion": "TerraNav-Research-v1.0",
        "modelLoaded": service.predictor is not None,
        "modelOperationalForLiveTraffic": False,
        "modelTrainingTarget": service.predictor.target_name if service.predictor is not None else None,
        "featureColumns": service.predictor.feature_columns if service.predictor is not None else [],
                "capabilities": ["predict", "research_route", "reroute", "update_traffic", "network_info"]
    }) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "PING":
            sys.stdout.write(json.dumps({"ok": True, "pong": True}) + "\n")
            sys.stdout.flush()
            continue

        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action", "predict")

            if action == "route":
                resp = handle_route_request(network, req)
                trip_id = req.get("trip_id")
                if resp.get("ok") and trip_id:
                    controller = DynamicReroutingController(network)
                    controller.set_active_route(resp["path_nodes"], float(req.get("start_time", time.time())))
                    active_trip_controllers[str(trip_id)] = controller
                    resp["trip_id"] = str(trip_id)
            elif action == "reroute":
                controller = active_trip_controllers.get(str(req.get("trip_id", "")))
                if controller is None:
                    resp = {"ok": False, "code": "ACTIVE_ROUTE_REQUIRED", "error": "Create a research route with this trip_id before requesting rerouting."}
                else:
                    resp = handle_reroute_request(controller, req)
            elif action == "update_traffic":
                resp = handle_update_traffic(network, req)
            elif action == "network_info":
                resp = {
                    "ok": True,
                    "network_name": network.name,
                    "operational_for_live_routing": False,
                    "data_provenance": "offline research graph with static corridor costs",
                    "geometry_quality": "intersection connectors; road-level geometry is unavailable",
                    "nodes_count": network.graph.number_of_nodes(),
                    "edges_count": network.graph.number_of_edges(),
                    "nodes": network.get_all_nodes(),
                }
            elif action == "ping":
                resp = {"ok": True, "pong": True}
            else:
                # Default: predict_segments
                rows = req.get("rows", [])
                if not rows and isinstance(req, list):
                    rows = req
                resp = service.predict_segments(rows)

            if req_id is not None:
                resp["id"] = req_id

            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {"ok": False, "error": str(e), "code": "DAEMON_ERROR"}
            if req_id is not None:
                err_resp["id"] = req_id
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


def run_single_shot(input_json_path: str):
    """Run single-shot prediction or route calculation from input JSON file or string."""
    service = ServingPredictorService()
    path = Path(input_json_path)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = json.loads(input_json_path)

    action = data.get("action", "predict") if isinstance(data, dict) else "predict"
    if action == "route":
        net = build_bengaluru_network()
        out = handle_route_request(net, data)
    elif action == "network_info":
        net = build_bengaluru_network()
        out = {
            "ok": True,
            "network_name": net.name,
            "operational_for_live_routing": False,
            "data_provenance": "offline research graph with static corridor costs",
            "geometry_quality": "intersection connectors; road-level geometry is unavailable",
            "nodes": net.get_all_nodes(),
        }
    else:
        rows = data if isinstance(data, list) else data.get("rows", [])
        out = service.predict_segments(rows)

    print(json.dumps(out, indent=2))


def main():
    parser = argparse.ArgumentParser(description="TerraNav Traffic ML & Routing Serving API")
    parser.add_argument("--daemon", action="store_true", help="Run as persistent line-based JSON daemon")
    parser.add_argument("--input", type=str, help="Path to input JSON file or JSON string")
    args = parser.parse_args()

    if args.daemon:
        run_daemon()
    elif args.input:
        run_single_shot(args.input)
    else:
        if not sys.stdin.isatty():
            content = sys.stdin.read().strip()
            if content:
                run_single_shot(content)
                return
        parser.print_help()


if __name__ == "__main__":
    main()
