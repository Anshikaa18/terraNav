"""Modular dynamic rerouting controller with hysteresis, thresholding, and oscillation prevention."""
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field

from terranav.config import (
    REROUTING_THRESHOLD_PERCENT,
    REROUTING_MIN_TIME_SAVING_SECONDS,
    REROUTING_COOLDOWN_SECONDS,
    IMPASSABLE_COST_SECONDS,
)
from terranav.network.graph_builder import RoadNetworkGraph
from terranav.routing.shortest_path import find_shortest_path, UnreachableDestinationError
from terranav.routing.costs import dynamic_traffic_cost


@dataclass
class RerouteDecision:
    """Encapsulates the decision, rationale, and quantitative metrics of a rerouting evaluation."""
    should_reroute: bool
    reason: str
    current_remaining_time_sec: float
    new_route_time_sec: float
    time_saved_sec: float
    improvement_percent: float
    is_mandatory: bool
    current_path: List[str]
    new_path: List[str]
    evaluation_time_sec: float


class DynamicReroutingController:
    """
    Rerouting engine governing route switching during active trips.
    Prevents route oscillation, respects driver switching cost, accounts for prediction
    uncertainty, and forces immediate rerouting upon roadway closures.
    """

    def __init__(
        self,
        road_network: RoadNetworkGraph,
        threshold_percent: float = REROUTING_THRESHOLD_PERCENT,
        min_time_saving_seconds: float = REROUTING_MIN_TIME_SAVING_SECONDS,
        cooldown_seconds: float = REROUTING_COOLDOWN_SECONDS,
        uncertainty_safety_factor: float = 0.5,
    ):
        self.road_network = road_network
        self.threshold_percent = threshold_percent
        self.min_time_saving_seconds = min_time_saving_seconds
        self.cooldown_seconds = cooldown_seconds
        self.uncertainty_safety_factor = uncertainty_safety_factor

        self.last_reroute_timestamp = -1e9
        self.reroute_count = 0
        self.active_route_nodes: List[str] = []

    def set_active_route(self, path_nodes: List[str], start_time: float = 0.0):
        """Register newly started route."""
        self.active_route_nodes = list(path_nodes)
        self.last_reroute_timestamp = start_time

    def evaluate_reroute(
        self,
        current_node: str,
        destination: str,
        current_timestamp: float,
    ) -> RerouteDecision:
        """
        Evaluate whether the vehicle should switch to an alternative route.

        Args:
            current_node: Current node location of the vehicle.
            destination: Final route destination.
            current_timestamp: Current simulation or real-time seconds.

        Returns:
            RerouteDecision object.
        """
        g = self.road_network.graph

        # 1. Determine remaining path along currently planned route
        if current_node in self.active_route_nodes:
            idx = self.active_route_nodes.index(current_node)
            current_remaining_nodes = self.active_route_nodes[idx:]
        else:
            # Vehicle diverged from planned path; must recompute
            current_remaining_nodes = [current_node, destination]

        # 2. Evaluate remaining cost and closure on current route
        current_remaining_time = 0.0
        current_route_blocked = False
        current_uncertainty = 0.0

        for i in range(len(current_remaining_nodes) - 1):
            u, v = current_remaining_nodes[i], current_remaining_nodes[i + 1]
            if not g.has_edge(u, v):
                current_route_blocked = True
                break
            edge = g[u][v]
            if edge.get("is_closed", False):
                current_route_blocked = True
                break
            current_remaining_time += edge.get("travel_time_seconds", 60.0)
            current_uncertainty += edge.get("uncertainty_kmh", 0.0)

        # 3. Check for Mandatory Reroute (road is impassable)
        if current_route_blocked:
            try:
                new_route = find_shortest_path(self.road_network, current_node, destination)
                self.active_route_nodes = new_route["path_nodes"]
                self.last_reroute_timestamp = current_timestamp
                self.reroute_count += 1
                return RerouteDecision(
                    should_reroute=True,
                    reason="MANDATORY: Ahead road segment is impassable or closed.",
                    current_remaining_time_sec=IMPASSABLE_COST_SECONDS,
                    new_route_time_sec=new_route["total_travel_time_seconds"],
                    time_saved_sec=IMPASSABLE_COST_SECONDS - new_route["total_travel_time_seconds"],
                    improvement_percent=100.0,
                    is_mandatory=True,
                    current_path=current_remaining_nodes,
                    new_path=new_route["path_nodes"],
                    evaluation_time_sec=current_timestamp,
                )
            except UnreachableDestinationError:
                return RerouteDecision(
                    should_reroute=False,
                    reason="CRITICAL: Ahead road is blocked and no alternative route exists.",
                    current_remaining_time_sec=IMPASSABLE_COST_SECONDS,
                    new_route_time_sec=IMPASSABLE_COST_SECONDS,
                    time_saved_sec=0.0,
                    improvement_percent=0.0,
                    is_mandatory=True,
                    current_path=current_remaining_nodes,
                    new_path=[],
                    evaluation_time_sec=current_timestamp,
                )

        # 4. Check Cooldown Period to prevent rapid oscillation
        time_since_last_reroute = current_timestamp - self.last_reroute_timestamp
        if time_since_last_reroute < self.cooldown_seconds:
            return RerouteDecision(
                should_reroute=False,
                reason=f"COOLDOWN_ACTIVE: Only {time_since_last_reroute:.1f}s since last reroute (min {self.cooldown_seconds:.1f}s).",
                current_remaining_time_sec=round(current_remaining_time, 1),
                new_route_time_sec=round(current_remaining_time, 1),
                time_saved_sec=0.0,
                improvement_percent=0.0,
                is_mandatory=False,
                current_path=current_remaining_nodes,
                new_path=current_remaining_nodes,
                evaluation_time_sec=current_timestamp,
            )

        # 5. Compute candidate optimal alternative route
        try:
            new_route = find_shortest_path(self.road_network, current_node, destination)
        except UnreachableDestinationError:
            return RerouteDecision(
                should_reroute=False,
                reason="NO_ALTERNATIVE: No alternative path found to destination.",
                current_remaining_time_sec=round(current_remaining_time, 1),
                new_route_time_sec=round(current_remaining_time, 1),
                time_saved_sec=0.0,
                improvement_percent=0.0,
                is_mandatory=False,
                current_path=current_remaining_nodes,
                new_path=current_remaining_nodes,
                evaluation_time_sec=current_timestamp,
            )

        new_time = new_route["total_travel_time_seconds"]
        time_saved = current_remaining_time - new_time
        pct_improvement = (time_saved / (current_remaining_time + 1e-9)) * 100.0

        # If the candidate route is identical to the current path
        if new_route["path_nodes"] == current_remaining_nodes:
            return RerouteDecision(
                should_reroute=False,
                reason="OPTIMAL: Current route remains the fastest path.",
                current_remaining_time_sec=round(current_remaining_time, 1),
                new_route_time_sec=round(new_time, 1),
                time_saved_sec=0.0,
                improvement_percent=0.0,
                is_mandatory=False,
                current_path=current_remaining_nodes,
                new_path=current_remaining_nodes,
                evaluation_time_sec=current_timestamp,
            )

        # 6. Apply Hysteresis & Benefit Threshold Filters
        has_min_savings = time_saved >= self.min_time_saving_seconds
        has_pct_threshold = (pct_improvement / 100.0) >= self.threshold_percent

        if has_min_savings and has_pct_threshold:
            self.active_route_nodes = new_route["path_nodes"]
            self.last_reroute_timestamp = current_timestamp
            self.reroute_count += 1
            return RerouteDecision(
                should_reroute=True,
                reason=f"REROUTE_JUSTIFIED: Saves {time_saved:.1f}s ({pct_improvement:.1f}% improvement).",
                current_remaining_time_sec=round(current_remaining_time, 1),
                new_route_time_sec=round(new_time, 1),
                time_saved_sec=round(time_saved, 1),
                improvement_percent=round(pct_improvement, 1),
                is_mandatory=False,
                current_path=current_remaining_nodes,
                new_path=new_route["path_nodes"],
                evaluation_time_sec=current_timestamp,
            )

        return RerouteDecision(
            should_reroute=False,
            reason=f"MARGINAL_BENEFIT: Savings of {time_saved:.1f}s ({pct_improvement:.1f}%) below threshold ({self.threshold_percent*100:.0f}% or {self.min_time_saving_seconds:.0f}s).",
            current_remaining_time_sec=round(current_remaining_time, 1),
            new_route_time_sec=round(new_time, 1),
            time_saved_sec=round(time_saved, 1),
            improvement_percent=round(pct_improvement, 1),
            is_mandatory=False,
            current_path=current_remaining_nodes,
            new_path=new_route["path_nodes"],
            evaluation_time_sec=current_timestamp,
        )
