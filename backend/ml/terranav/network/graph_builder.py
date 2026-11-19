"""Directed road network graph representation using NetworkX."""
from typing import Dict, List, Optional, Tuple, Any, Set
import math
import networkx as nx
import numpy as np

from terranav.config import (
    MIN_SPEED_FLOOR_KMH,
    KMH_TO_MPS,
    IMPASSABLE_COST_SECONDS,
)
from terranav.data.validation import validate_coordinates, speed_to_travel_time


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return float(R * c)


class RoadNetworkGraph:
    """
    Directed road network graph G = (V, E).
    Vertices represent intersections or decision nodes.
    Edges represent directed traversable road segments with dynamic traffic costs.
    """

    def __init__(self, name: str = "BengaluruRoadNetwork"):
        self.name = name
        self.graph = nx.DiGraph(name=name)

    def add_intersection(
        self,
        node_id: str,
        lat: float,
        lon: float,
        name: Optional[str] = None,
        area: Optional[str] = None,
    ):
        """Add an intersection node to the network."""
        if not validate_coordinates(lat, lon):
            raise ValueError(f"Invalid coordinate bounds for node {node_id}: ({lat}, {lon})")
        self.graph.add_node(
            node_id,
            lat=float(lat),
            lon=float(lon),
            name=name or node_id,
            area=area or "Central",
        )

    def add_road_segment(
        self,
        u: str,
        v: str,
        segment_id: str,
        length_meters: Optional[float] = None,
        speed_limit_kmh: float = 50.0,
        free_flow_speed_kmh: float = 45.0,
        road_class: str = "primary",
        oneway: bool = False,
    ):
        """Add directed road segment (edge) with initial free-flow characteristics."""
        if u not in self.graph or v not in self.graph:
            raise KeyError(f"Both nodes '{u}' and '{v}' must exist in graph before adding edge.")

        # Compute geometric distance if length not provided
        u_lat, u_lon = self.graph.nodes[u]["lat"], self.graph.nodes[u]["lon"]
        v_lat, v_lon = self.graph.nodes[v]["lat"], self.graph.nodes[v]["lon"]
        dist = length_meters or haversine_distance_meters(u_lat, u_lon, v_lat, v_lon)

        free_flow_speed = max(MIN_SPEED_FLOOR_KMH, free_flow_speed_kmh)
        base_travel_time = speed_to_travel_time(dist, free_flow_speed)

        edge_data = {
            "segment_id": segment_id,
            "length_meters": float(dist),
            "speed_limit_kmh": float(speed_limit_kmh),
            "free_flow_speed_kmh": float(free_flow_speed),
            "road_class": road_class,
            "current_speed_kmh": float(free_flow_speed),
            "predicted_speed_kmh": float(free_flow_speed),
            "travel_time_seconds": float(base_travel_time),
            "static_travel_time_seconds": float(base_travel_time),
            "uncertainty_kmh": 0.0,
            "is_closed": False,
            "data_freshness_seconds": 0.0,
            "incident_penalty_seconds": 0.0,
        }

        self.graph.add_edge(u, v, **edge_data)

        # If bidirectional, add reverse edge
        if not oneway:
            rev_segment_id = f"{segment_id}_rev"
            self.graph.add_edge(v, u, **{**edge_data, "segment_id": rev_segment_id})

    def update_edge_traffic(
        self,
        u: str,
        v: str,
        predicted_speed_kmh: float,
        uncertainty_kmh: float = 0.0,
        incident_penalty_seconds: float = 0.0,
        is_closed: bool = False,
        freshness_seconds: float = 0.0,
    ):
        """Update dynamic edge travel cost with new ML traffic forecast or incident."""
        if not self.graph.has_edge(u, v):
            raise KeyError(f"Edge ({u}, {v}) does not exist in graph.")

        edge = self.graph[u][v]
        length = edge["length_meters"]

        effective_speed = max(MIN_SPEED_FLOOR_KMH, float(predicted_speed_kmh))
        travel_time = speed_to_travel_time(length, effective_speed, is_closed=is_closed)
        if not is_closed:
            travel_time += max(0.0, incident_penalty_seconds)

        edge["predicted_speed_kmh"] = effective_speed
        edge["current_speed_kmh"] = effective_speed
        edge["travel_time_seconds"] = travel_time
        edge["uncertainty_kmh"] = float(uncertainty_kmh)
        edge["incident_penalty_seconds"] = float(incident_penalty_seconds)
        edge["is_closed"] = bool(is_closed)
        edge["data_freshness_seconds"] = float(freshness_seconds)

    def validate_network(self) -> Dict[str, Any]:
        """Validate network topology, connectivity, and coordinate consistency."""
        num_nodes = self.graph.number_of_nodes()
        num_edges = self.graph.number_of_edges()

        is_strongly_connected = nx.is_strongly_connected(self.graph) if num_nodes > 0 else False
        is_weakly_connected = nx.is_weakly_connected(self.graph) if num_nodes > 0 else False

        weakly_connected_components = list(nx.weakly_connected_components(self.graph))
        strongly_connected_components = list(nx.strongly_connected_components(self.graph))

        # Check self-loops
        self_loops = list(nx.nodes_with_selfloops(self.graph))

        # Check negative or zero length edges
        invalid_lengths = [
            (u, v) for u, v, d in self.graph.edges(data=True) if d.get("length_meters", 0.0) <= 0.0
        ]

        return {
            "num_nodes": num_nodes,
            "num_edges": num_edges,
            "is_strongly_connected": is_strongly_connected,
            "is_weakly_connected": is_weakly_connected,
            "num_weak_components": len(weakly_connected_components),
            "num_strong_components": len(strongly_connected_components),
            "self_loops_count": len(self_loops),
            "invalid_length_edges_count": len(invalid_lengths),
            "is_valid": len(self_loops) == 0 and len(invalid_lengths) == 0 and is_weakly_connected,
        }

    def find_nearest_node(self, lat: float, lon: float, max_distance_meters: float = 8000.0) -> Tuple[Optional[str], float]:
        """Find the closest intersection node to given GPS coordinates within search radius."""
        nearest_node = None
        min_dist = float("inf")
        for node_id, data in self.graph.nodes(data=True):
            n_lat, n_lon = data.get("lat"), data.get("lon")
            if n_lat is not None and n_lon is not None:
                d = haversine_distance_meters(lat, lon, n_lat, n_lon)
                if d < min_dist:
                    min_dist = d
                    nearest_node = node_id
        if min_dist <= max_distance_meters:
            return nearest_node, min_dist
        return None, min_dist

    def get_all_nodes(self) -> Dict[str, Dict[str, Any]]:
        """Return all network intersections with geographic coordinates and metadata."""
        return {
            node_id: {
                "id": node_id,
                "name": data.get("name", node_id),
                "area": data.get("area", "Central"),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
            }
            for node_id, data in self.graph.nodes(data=True)
        }

    def get_route_coordinates(self, path_nodes: List[str]) -> List[List[float]]:
        """Extract road-following [lat, lon] coordinates for a sequence of path nodes."""
        coords = []
        for i in range(len(path_nodes)):
            node = path_nodes[i]
            if node in self.graph:
                coords.append([self.graph.nodes[node]["lat"], self.graph.nodes[node]["lon"]])
        return coords



def build_bengaluru_network() -> RoadNetworkGraph:
    """
    Construct realistic Bengaluru arterial road network connecting the 16 corridors.
    Uses accurate geographical coordinates and realistic multi-path topology.
    """
    net = RoadNetworkGraph("Bengaluru_Arterial_Network")

    # Real GPS Coordinates of the 16 corridors/intersections
    intersections = {
        "ANIL_KUMBLE": {"lat": 12.9754, "lon": 77.6053, "name": "Anil Kumble Circle", "area": "M.G. Road"},
        "TRINITY": {"lat": 12.9733, "lon": 77.6200, "name": "Trinity Circle", "area": "M.G. Road"},
        "100_FT_RD": {"lat": 12.9680, "lon": 77.6405, "name": "100 Feet Road", "area": "Indiranagar"},
        "CMH_RD": {"lat": 12.9782, "lon": 77.6390, "name": "CMH Road", "area": "Indiranagar"},
        "MARATHAHALLI": {"lat": 12.9560, "lon": 77.7011, "name": "Marathahalli Bridge", "area": "Whitefield"},
        "ITPL": {"lat": 12.9863, "lon": 77.7338, "name": "ITPL Main Road", "area": "Whitefield"},
        "SONY_WORLD": {"lat": 12.9352, "lon": 77.6245, "name": "Sony World Junction", "area": "Koramangala"},
        "SILK_BOARD": {"lat": 12.9176, "lon": 77.6234, "name": "Silk Board Junction", "area": "Koramangala"},
        "HOSUR_RD": {"lat": 12.8950, "lon": 77.6400, "name": "Hosur Road", "area": "Electronic City"},
        "E_CITY": {"lat": 12.8452, "lon": 77.6602, "name": "Electronic City", "area": "Electronic City"},
        "SOUTH_END": {"lat": 12.9281, "lon": 77.5817, "name": "South End Circle", "area": "Jayanagar"},
        "JAYANAGAR_4TH": {"lat": 12.9304, "lon": 77.5838, "name": "Jayanagar 4th Block", "area": "Jayanagar"},
        "BALLARI_RD": {"lat": 13.0105, "lon": 77.5855, "name": "Ballari Road", "area": "Hebbal"},
        "HEBBAL": {"lat": 13.0358, "lon": 77.5970, "name": "Hebbal Flyover", "area": "Hebbal"},
        "YESHWANTHPUR": {"lat": 13.0238, "lon": 77.5503, "name": "Yeshwanthpur Circle", "area": "Yeshwanthpur"},
        "TUMKUR_RD": {"lat": 13.0450, "lon": 77.5200, "name": "Tumkur Road", "area": "Yeshwanthpur"},
    }

    for node_id, data in intersections.items():
        net.add_intersection(node_id, data["lat"], data["lon"], data["name"], data["area"])

    # Road Segments connecting intersections (bidirectional arterial links)
    segments = [
        # Central Spine (MG Road - Trinity)
        ("ANIL_KUMBLE", "TRINITY", "seg_mg_road", 50.0, 40.0, "primary"),
        # East Corridor (Trinity - Indiranagar - Whitefield)
        ("TRINITY", "CMH_RD", "seg_trinity_cmh", 50.0, 35.0, "primary"),
        ("TRINITY", "100_FT_RD", "seg_trinity_100ft", 50.0, 35.0, "primary"),
        ("CMH_RD", "100_FT_RD", "seg_cmh_100ft", 40.0, 30.0, "secondary"),
        ("100_FT_RD", "MARATHAHALLI", "seg_old_airport_rd", 60.0, 45.0, "trunk"),
        ("MARATHAHALLI", "ITPL", "seg_itpl_main", 60.0, 45.0, "trunk"),
        # South-East Corridor (Trinity / Indiranagar to Koramangala / Silk Board)
        ("TRINITY", "SONY_WORLD", "seg_inner_ring_rd", 60.0, 45.0, "trunk"),
        ("100_FT_RD", "SONY_WORLD", "seg_indiranagar_koramangala", 50.0, 35.0, "primary"),
        ("SONY_WORLD", "SILK_BOARD", "seg_koramangala_silkboard", 50.0, 30.0, "primary"),
        ("MARATHAHALLI", "SILK_BOARD", "seg_orr_east", 70.0, 50.0, "trunk"),
        # South Corridor (Silk Board to Electronic City)
        ("SILK_BOARD", "HOSUR_RD", "seg_hosur_rd_north", 60.0, 40.0, "trunk"),
        ("HOSUR_RD", "E_CITY", "seg_electronic_city_flyover", 80.0, 65.0, "motorway"),
        # South-West Corridor (Jayanagar & Silk Board links)
        ("SILK_BOARD", "JAYANAGAR_4TH", "seg_btm_jayanagar", 50.0, 35.0, "primary"),
        ("JAYANAGAR_4TH", "SOUTH_END", "seg_jayanagar_southend", 40.0, 30.0, "secondary"),
        ("SOUTH_END", "ANIL_KUMBLE", "seg_southend_central", 50.0, 35.0, "primary"),
        ("SONY_WORLD", "SOUTH_END", "seg_koramangala_jayanagar", 50.0, 35.0, "primary"),
        # North Corridor (Central to Hebbal & Ballari Road)
        ("ANIL_KUMBLE", "BALLARI_RD", "seg_sankey_ballari", 50.0, 40.0, "primary"),
        ("BALLARI_RD", "HEBBAL", "seg_ballari_hebbal", 70.0, 55.0, "trunk"),
        ("MARATHAHALLI", "HEBBAL", "seg_orr_north_east", 70.0, 50.0, "trunk"),
        # North-West Corridor (Hebbal to Yeshwanthpur & Tumkur Road)
        ("HEBBAL", "YESHWANTHPUR", "seg_orr_north_west", 70.0, 55.0, "trunk"),
        ("YESHWANTHPUR", "TUMKUR_RD", "seg_tumkur_rd", 70.0, 50.0, "trunk"),
        ("YESHWANTHPUR", "BALLARI_RD", "seg_yeshwanthpur_ballari", 60.0, 45.0, "primary"),
        ("YESHWANTHPUR", "ANIL_KUMBLE", "seg_malleshwaram_central", 50.0, 35.0, "primary"),
    ]

    for u, v, seg_id, limit, free_flow, r_class in segments:
        net.add_road_segment(
            u=u,
            v=v,
            segment_id=seg_id,
            speed_limit_kmh=limit,
            free_flow_speed_kmh=free_flow,
            road_class=r_class,
            oneway=False,
        )

    return net
