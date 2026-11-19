"""Time-dependent routing accounting for evolving future conditions at edge arrival time."""
from typing import Dict, List, Optional, Tuple, Any, Callable
import heapq
import numpy as np

from terranav.config import (
    MIN_SPEED_FLOOR_KMH,
    IMPASSABLE_COST_SECONDS,
)
from terranav.network.graph_builder import RoadNetworkGraph
from terranav.data.validation import speed_to_travel_time
from terranav.routing.shortest_path import UnreachableDestinationError


def evaluate_time_dependent_path_cost(
    road_network: RoadNetworkGraph,
    path_nodes: List[str],
    departure_time_seconds: float = 0.0,
    speed_forecast_provider: Optional[Callable[[str, str, float], float]] = None,
) -> Dict[str, Any]:
    """
    Evaluate total traversal time for a sequence of path nodes where each edge
    is evaluated using the expected speed at the vehicle's arrival time.

    Args:
        road_network: RoadNetworkGraph instance.
        path_nodes: List of consecutive nodes along the route.
        departure_time_seconds: Departure timestamp in seconds.
        speed_forecast_provider: Optional function (u, v, arrival_time) -> speed_kmh.

    Returns:
        Dictionary with arrival times per node, total time, and step breakdown.
    """
    g = road_network.graph
    current_time = departure_time_seconds
    total_distance = 0.0
    timeline = []

    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        if not g.has_edge(u, v):
            raise ValueError(f"Path contains non-existent edge ({u}, {v})")

        edge = g[u][v]
        length = edge["length_meters"]
        is_closed = edge.get("is_closed", False)

        if is_closed:
            return {
                "is_valid": False,
                "error": f"Road segment ({u} -> {v}) is closed.",
                "total_travel_time_seconds": IMPASSABLE_COST_SECONDS,
            }

        if speed_forecast_provider is not None:
            speed_kmh = speed_forecast_provider(u, v, current_time)
        else:
            speed_kmh = edge.get("predicted_speed_kmh", edge.get("free_flow_speed_kmh", 45.0))

        effective_speed = max(MIN_SPEED_FLOOR_KMH, speed_kmh)
        traversal_time = speed_to_travel_time(length, effective_speed)

        timeline.append({
            "from_node": u,
            "to_node": v,
            "departure_time_seconds": round(current_time, 1),
            "arrival_time_seconds": round(current_time + traversal_time, 1),
            "traversal_time_seconds": round(traversal_time, 1),
            "speed_kmh": round(effective_speed, 1),
            "length_meters": round(length, 1),
        })

        current_time += traversal_time
        total_distance += length

    return {
        "is_valid": True,
        "departure_time_seconds": departure_time_seconds,
        "arrival_time_seconds": round(current_time, 1),
        "total_travel_time_seconds": round(current_time - departure_time_seconds, 1),
        "total_distance_meters": round(total_distance, 1),
        "timeline": timeline,
    }
