"""Global configuration and parameter specifications for TerraNav Dynamic Route Rationalization."""
from pathlib import Path
from typing import Dict, List, Any

# Root filesystem paths
ML_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ML_DIR.parent
DATA_DIR = ML_DIR / "data"
ARTIFACTS_DIR = ML_DIR / "artifacts"
REPORTS_DIR = ML_DIR / "reports"
CONFIGS_DIR = ML_DIR / "configs"
SCRIPTS_DIR = ML_DIR / "scripts"
ROOT_DIR = BACKEND_DIR.parent

# Canonical raw dataset file paths
DUMAS_TRAJECTORY_PATH = DATA_DIR / "Trajectorydatadumasroad.xlsx"
BANGLORE_TRAFFIC_PATH = DATA_DIR / "Banglore_traffic_Dataset.csv"
CHUNKFLOW_BEFORE_PATH = DATA_DIR / "before processing.csv"
CHUNKFLOW_AFTER_PATH = DATA_DIR / "after processing.csv"

# Physical constants and conversion parameters
KMH_TO_MPS = 1.0 / 3.6
MPS_TO_KMH = 3.6

# Minimum speed floor (in km/h). Used to prevent division by zero in travel-time conversion:
# T = L / max(v, MIN_SPEED_FLOOR_KMH)
# Value of 5.0 km/h represents heavy crawling traffic. Road closures are handled separately.
MIN_SPEED_FLOOR_KMH = 5.0
MIN_SPEED_FLOOR_MPS = MIN_SPEED_FLOOR_KMH * KMH_TO_MPS
MAX_PHYSICAL_SPEED_KMH = 130.0

# Prediction horizons
TRAJECTORY_HORIZONS_SECONDS = [5, 15, 30]
SEGMENT_HORIZONS_MINUTES = [5, 15, 30]

# Known leakage features in ChunkFlow to exclude unconditionally
CHUNKFLOW_LEAKAGE_FEATURES: List[str] = [
    "x_LEAK_Road_Average_Speed",
    "x_LEAK_Road_Traffic_Volume",
    "x_LEAK_Incident_Reports",
    "x_LEAK_Road_Roadwork_Activity_Yes",
    "x_LEAK_Queue_per_Chunk_Length",
    "x_LEAK_Volume_per_km_proxy_log"
]

# Clean feature columns for segment prediction (17 features)
CHUNKFLOW_CLEAN_FEATURES: List[str] = [
    "x_Estimated Chunk Traffic Volume (synthetic)",
    "x_Estimated Queue Length (m; synthetic)",
    "x_Estimated Signal Delay (sec; synthetic)",
    "x_Estimated Incident Delay (sec; synthetic)",
    "x_Estimated Roadwork Delay (sec; synthetic)",
    "x_Chunk Length (m)",
    "x_Road Capacity Utilization",
    "x_Traffic Signal Present_Yes",
    "x_Roadwork in Chunk_Yes",
    "x_Weather Conditions_Fog",
    "x_Weather Conditions_Overcast",
    "x_Weather Conditions_Rain",
    "x_Weather Conditions_Windy",
    "x_Chunk Sequence_2",
    "x_Chunk Sequence_3",
    "x_Chunk Sequence_4",
    "x_Chunk Sequence_5"
]

# Trajectory model base feature names
TRAJECTORY_BASE_FEATURES: List[str] = [
    "time_s",
    "position_m",
    "lateral_position_m",
    "vehicle_type",
    "speed_now_kmh",
    "acceleration_mps2",
    "lateral_velocity_mps",
    "lateral_acceleration_mps2",
    "speed_lag_2s_kmh",
    "speed_lag_5s_kmh",
    "speed_mean_prev_5s_kmh"
]

# Routing and rerouting thresholds
REROUTING_THRESHOLD_PERCENT = 0.12  # Minimum 12% improvement required to reroute
REROUTING_MIN_TIME_SAVING_SECONDS = 90.0  # Minimum 90 seconds absolute saving
REROUTING_COOLDOWN_SECONDS = 60.0  # Cooldown between consecutive reroutes to avoid oscillation
IMPASSABLE_COST_SECONDS = 1e9  # Cost for impassable/closed road segment

# Unseen corridors for spatial holdout (Regime B)
HELD_OUT_CORRIDORS: List[str] = [
    "Silk Board Junction",
    "Hosur Road",
    "ITPL Main Road",
    "Tumkur Road"
]

# Temporal split cutoff for chronological holdout (Regime C)
CHRONOLOGICAL_SPLIT_DATE = "2024-01-01"

RANDOM_STATE = 42
