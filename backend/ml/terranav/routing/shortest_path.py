"""Shortest-path routing implementations (Dijkstra and A*) on road graphs."""
from typing import Dict, List, Optional, Tuple, Any, Callable
import heapq
import networkx as nx

from terranav.config import (
    MAX_PHYSICAL_SPEED_KMH,
    KMH_TO_MPS,
    IMPASSABLE_COST_SECONDS,
)
from terranav.network.graph_builder import haversine_distance_meters, RoadNetworkGraph
from terranav.routing.costs import get_cost_function, dynamic_traffic_cost


class UnreachableDestinationError(Exception):
    """Raised when no traversable path exists between origin and destination."""
    pass


def find_shortest_path(
    road_network: RoadNetworkGraph,
    origin: str,
    destination: str,
    cost_function: Optional[Callable[[str, str, Dict[str, Any]], float]] = None,
    algorithm: str = "astar",
) -> Dict[str, Any]:
    """
    Compute optimal route between origin and destination using Dijkstra or A*.

    Args:
        road_network: RoadNetworkGraph instance.
        origin: Origin node identifier.
        destination: Destination node identifier.
        cost_function: Callable(u, v, edge_data) returning positive traversal cost.
        algorithm: 'astar' or 'dijkstra'.

    Returns:
        Structured dictionary containing path nodes, sequence of road segments,
        total travel time, total distance, and routing metadata.
    """
    g = road_network.graph
    if origin not in g:
        raise KeyError(f"Origin node '{origin}' not found in road network.")
    if destination not in g:
        raise KeyError(f"Destination node '{destination}' not found in road network.")

    if origin == destination:
        return {
            "origin": origin,
            "destination": destination,
            "path_nodes": [origin],
            "segments": [],
            "total_distance_meters": 0.0,
            "total_travel_time_seconds": 0.0,
            "is_reachable": True,
            "algorithm": algorithm,
        }

    weight_fn = cost_function or dynamic_traffic_cost

    # Admissible heuristic for A*: Euclidean/Haversine distance divided by max physical speed
    dest_lat = g.nodes[destination]["lat"]
    dest_lon = g.nodes[destination]["lon"]
    max_speed_mps = MAX_PHYSICAL_SPEED_KMH * KMH_TO_MPS

    def heuristic(u_node: str, _: str) -> float:
        u_lat = g.nodes[u_node]["lat"]
        u_lon = g.nodes[u_node]["lon"]
        dist = haversine_distance_meters(u_lat, u_lon, dest_lat, dest_lon)
        return dist / max_speed_mps

    try:
        if algorithm == "astar":
            path_nodes = nx.astar_path(
                g,
                source=origin,
                target=destination,
                heuristic=heuristic,
                weight=lambda u, v, d: weight_fn(u, v, d),
            )
        else:
            path_nodes = nx.dijkstra_path(
                g,
                source=origin,
                target=destination,
                weight=lambda u, v, d: weight_fn(u, v, d),
            )
    except nx.NetworkXNoPath:
        raise UnreachableDestinationError(f"No path exists between '{origin}' and '{destination}'.")

    # Traverse path nodes to extract segment metrics and verify no impassable edges
    total_dist = 0.0
    total_time = 0.0
    segments = []

    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        edge = g[u][v]
        cost = weight_fn(u, v, edge)

        if cost >= IMPASSABLE_COST_SECONDS or edge.get("is_closed", False):
            raise UnreachableDestinationError(f"Route is blocked by closed segment ({u} -> {v}).")

        length = edge.get("length_meters", 0.0)
        t_sec = edge.get("travel_time_seconds", cost)

        total_dist += length
        total_time += t_sec

        segments.append({
            "from_node": u,
            "to_node": v,
            "segment_id": edge.get("segment_id", f"{u}_{v}"),
            "road_class": edge.get("road_class", "primary"),
            "length_meters": float(round(length, 1)),
            "speed_kmh": float(round(edge.get("current_speed_kmh", 40.0), 1)),
            "travel_time_seconds": float(round(t_sec, 1)),
            "is_closed": edge.get("is_closed", False),
        })

    return {
        "origin": origin,
        "destination": destination,
        "path_nodes": path_nodes,
        "segments": segments,
        "total_distance_meters": float(round(total_dist, 1)),
        "total_travel_time_seconds": float(round(total_time, 1)),
        "is_reachable": True,
        "algorithm": algorithm,
    }
