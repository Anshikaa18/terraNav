"""Routing cost functions and edge evaluation policies."""
from typing import Dict, Any, Callable
from terranav.config import (
    MIN_SPEED_FLOOR_KMH,
    KMH_TO_MPS,
    IMPASSABLE_COST_SECONDS,
)
from terranav.data.validation import speed_to_travel_time


def distance_cost(u: str, v: str, edge_data: Dict[str, Any]) -> float:
    """Routing cost based strictly on geometric road segment distance in meters."""
    return float(edge_data.get("length_meters", 1000.0))


def static_travel_time_cost(u: str, v: str, edge_data: Dict[str, Any]) -> float:
    """Routing cost based on static free-flow travel time in seconds."""
    if edge_data.get("is_closed", False):
        return IMPASSABLE_COST_SECONDS
    return float(edge_data.get("static_travel_time_seconds", 60.0))


def dynamic_traffic_cost(u: str, v: str, edge_data: Dict[str, Any]) -> float:
    """
    Routing cost based on dynamic ML-predicted traversal time in seconds.
    Accounts for segment closures, forecast speeds, and active incident delays.
    """
    if edge_data.get("is_closed", False):
        return IMPASSABLE_COST_SECONDS

    # Dynamic travel time already includes incident penalties and speed floor
    cost = float(edge_data.get("travel_time_seconds", 60.0))
    return cost


def get_cost_function(policy: str = "dynamic_ml") -> Callable[[str, str, Dict[str, Any]], float]:
    """Factory to retrieve edge cost evaluator for a given routing policy."""
    policies = {
        "shortest_distance": distance_cost,
        "static_free_flow": static_travel_time_cost,
        "dynamic_ml": dynamic_traffic_cost,
    }
    if policy not in policies:
        raise ValueError(f"Unknown routing policy '{policy}'. Available: {list(policies.keys())}")
    return policies[policy]
