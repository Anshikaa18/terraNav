"""TerraNav Optimized ML System for Dynamic Route Rationalization."""
__version__ = "1.0.0"

from terranav.config import (
    MIN_SPEED_FLOOR_KMH,
    MAX_PHYSICAL_SPEED_KMH,
    REROUTING_THRESHOLD_PERCENT,
    REROUTING_MIN_TIME_SAVING_SECONDS,
)
from terranav.data.validation import speed_to_travel_time, travel_time_to_speed_kmh
from terranav.network.graph_builder import RoadNetworkGraph, build_bengaluru_network
from terranav.routing.shortest_path import find_shortest_path
from terranav.routing.rerouting import DynamicReroutingController, RerouteDecision
from terranav.models.prediction import TrafficPredictor
