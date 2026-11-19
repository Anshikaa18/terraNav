# Data Inventory and Provenance Report

**System:** TerraNav / ChunkFlow Dynamic Route Rationalization ML System  
**Audit Date:** October 2026  
**Environment:** Python 3.12 (Windows x86_64)  

---

## 1. Executive Summary

This inventory audits all datasets and archive files available within the workspace. Four primary data assets and two pre-trained model suites were identified and subjected to cryptographic verification, schema validation, and provenance analysis:

1. **`Trajectorydatadumasroad.xlsx`**: High-frequency vehicle trajectory records from Dumas Road, Surat, India (video camera extraction).
2. **`Banglore_traffic_Dataset.csv`**: Daily aggregated traffic summaries across 16 arterial road corridors in Bengaluru, India.
3. **`before processing.csv`**: Corridor-to-chunk partitioned dataset (5 segments per road) with synthetic delay and speed augmentations.
4. **`after processing.csv`**: Normalized and one-hot-encoded dataset containing 23 features, including 6 severe target leakage features and 2 targets.
5. **Model Archives**: `ChunkFlow_Release_v1.0.zip` and pre-trained `.joblib` model bundles from ChunkFlow and TerraNav-ML.

---

## 2. Comprehensive File Inventory & Cryptographic Hashes

| Logical Identifier | File Path | Format | Size (Bytes) | SHA-256 Checksum | License / Permitted Usage |
|---|---|---|---|---|---|
| **Dumas Trajectory** | `data-set-for-ChunkFlow/Trajectorydatadumasroad.xlsx` | Excel (.xlsx) | 9,343,656 | `f8d87b88fc2bcd562304892c902ff6a5ffc116d445dbdd6a80447385f973fa78` | Research / Academic benchmark (unspecified public license; no commercial grant) |
| **Bengaluru Traffic** | `data-set-for-ChunkFlow/Banglore_traffic_Dataset.csv` | CSV (UTF-8) | 1,535,462 | `2d7636e53b641a0429f4a56c42965ceb52eb4b7454f89d38c644917415250ff4` | Synthetic/Educational open benchmark (unverified original license) |
| **ChunkFlow Before** | `ML/before processing.csv` | CSV (UTF-8) | 8,132,335 | `a57cbb64e66ffb0b001a1db158a1eebe22756d11f939e6a0d2f09805906ef709` | Derived project asset (internal ChunkFlow pipeline) |
| **ChunkFlow After** | `ML/after processing.csv` | CSV (UTF-8) | 13,910,550 | `9d460c880290b6a037b58797b5f5434190ea4cb8fa087c53d9e334a1d5db2836` | Derived project asset (internal ChunkFlow pipeline) |
| **ChunkFlow Release** | `ChunkFlow_Release_v1.0.zip` | ZIP Archive | 514,735 | `6062a43329249e9cfda4752fa397223692d47b357fbb7a8716b0b2e3f433917d` | Project release distribution |

---

## 3. Dataset Profiles and Specifications

### 3.1 Dumas Road Vehicle Trajectory Dataset (`Trajectorydatadumasroad.xlsx`)
- **Source & Methodology:** Extracted from continuous video feeds recorded by 4 wide-angle digital cameras mounted on a foot-over-bridge on Dumas Road in Surat, India. Cameras monitored 4 contiguous traps (230m, 120m, 100m, 75m) spanning a 535m total study stretch of a 3-lane (10.5m wide) carriageway. Trajectories were stitched across camera boundaries with an estimated 85% tracking accuracy.
- **Structure:** 23 narrative preamble rows describing collection geometry and vehicle type codings, followed by a 9-column table starting at row index 24 (header row 23).
- **Observations:** 59,614 non-null numeric observations across 702 distinct vehicle tracks.
- **Temporal Horizon & Frequency:** Observation timestamps range from $0.0\text{ s}$ to $1,230.0\text{ s}$ (20.5 minutes). Sampling interval is strictly $0.5\text{ s}$ between successive within-track points ($100\%$ uniform).
- **Spatial Bounds:** Longitudinal position ranges from $0.0\text{ m}$ to $535.0\text{ m}$; lateral position across lanes ranges from $0.0\text{ m}$ to $10.5\text{ m}$.
- **Variables & Units:**
  - `Vehicle No.`: Track identifier (integer 1–702).
  - `Time (s)`: Elapsed seconds from recording start ($0.5\text{ s}$ increments).
  - `vehicle type`: Categorical code (1=auto/three-wheeler, 2=bike/two-wheeler, 3=bus [0 rows], 4=car, 5=truck, 6=light commercial vehicle).
  - `logitudinal`: Longitudinal coordinate along trap in metres ($0–535\text{ m}$).
  - `lateral`: Transverse coordinate across roadway in metres ($0–10.5\text{ m}$).
  - `longitudinal speed`: Longitudinal speed in metres/second ($\text{m/s}$), signed (range: $-13.34$ to $+30.05\text{ m/s}$).
  - `longitudinal accleration`: Longitudinal acceleration in $\text{m/s}^2$ (range: $-14.88$ to $+13.51\text{ m/s}^2$).
  - `lateral velocity`: Lateral speed across roadway in $\text{m/s}$.
  - `lateral acceleration`: Lateral acceleration across roadway in $\text{m/s}^2$.
- **Data Reality:** **Observed physical measurements** from computer vision, but limited to a single 535m corridor for 20 minutes. It does not provide road network routing choices or multi-day traffic patterns.

---

### 3.2 Bengaluru Urban Traffic Dataset (`Banglore_traffic_Dataset.csv`)
- **Source & Context:** Tabular traffic summary dataset across 16 major traffic corridors and intersections in Bengaluru, India.
- **Structure:** 8,936 rows × 16 columns.
- **Geographic Coverage:** 16 named intersections/corridors across 8 administrative areas:
  - *Areas:* Electronic City, Hebbal, Indiranagar, Jayanagar, Koramangala, M.G. Road, Whitefield, Yeshwanthpur.
  - *Corridors:* 100 Feet Road, Anil Kumble Circle, Ballari Road, CMH Road, Hebbal Flyover, Hosur Road, ITPL Main Road, Jayanagar 4th Block, Marathahalli Bridge, Sarjapur Road, Silk Board Junction, Sony World Junction, South End Circle, Trinity Circle, Tumkur Road, Yeshwanthpur Circle.
- **Temporal Coverage:** 952 unique daily calendar dates spanning `2022-01-01` to `2024-08-09`. There is strictly one record per (Date, Corridor) pair.
- **Variables & Units:**
  - `Date`: Calendar date string (`YYYY-MM-DD`).
  - `Area Name` & `Road/Intersection Name`: Text identifiers.
  - `Traffic Volume`: Daily vehicle volume count (range: 4,233 to 72,039 vehicles/day, mean: 29,236).
  - `Average Speed`: Correlated road speed in km/h (range: 20.0 to 89.8 km/h, mean: 39.45 km/h, std: 10.71).
  - `Travel Time Index`: Ratio of peak travel time to free-flow time (range: 1.10 to 3.80).
  - `Congestion Level`: Aggregate index (0–100 scale).
  - `Road Capacity Utilization`: Percentage of corridor capacity utilized (range: 15% to 98%).
  - `Incident Reports`: Daily integer incident count (range: 0 to 5).
  - `Weather Conditions`: Categorical string (`Clear`, `Overcast`, `Rain`, `Fog`, `Windy`).
  - `Roadwork and Construction Activity`: Binary string (`Yes`, `No`).
- **Data Reality:** **Macroscopic daily summary** without sub-hourly timestamps. The uniform distribution across 952 dates suggests synthetic generation from parametric distributions modeled after Bengaluru corridor names.

---

### 3.3 ChunkFlow Pre-Processed Dataset (`before processing.csv`)
- **Source & Derivation:** Created by ChunkFlow authors by taking the 8,936 Bengaluru daily records and synthesizing 5 sequential chunks (Chunk Sequence 1 to 5) per road record ($8,936 \times 5 = 44,680\text{ rows}$).
- **Structure:** 44,680 rows × 30 columns.
- **Synthesized Fields:**
  - `Chunk Length (m)`: Segment length ranging from 120m to 460m (mean: 268.99m).
  - `Estimated Chunk Traffic Volume (synthetic)`: Synthesized hourly volume.
  - `Estimated Chunk Speed (km/h; synthetic)`: Target speed derived via simulation formula.
  - `Estimated Signal Delay (sec; synthetic)`: 25s if signal present, else 0s.
  - `Estimated Queue Length (m; synthetic)`: Derived from length and capacity utilization proxy.
  - `Estimated Incident Delay (sec; synthetic)`: Step delay (180s to 480s) when incident flag active.
  - `Estimated Roadwork Delay (sec; synthetic)`: Step delay when construction flag active.
- **Data Reality:** **Partially synthetic**. Road names and base dates originate from Bengaluru CSV, but all micro-segment features and chunk targets were generated synthetically.

---

### 3.4 ChunkFlow Feature-Engineered Dataset (`after processing.csv`)
- **Source:** Scaled, log-transformed, and one-hot-encoded representation of `before processing.csv`.
- **Structure:** 44,680 rows × 26 columns.
- **Split Breakdown:** `train`: 31,270 rows (70%), `val`: 6,705 rows (15%), `test`: 6,705 rows (15%). Split was generated via random row partitioning without corridor or temporal grouping.
- **Targets:**
  1. `Estimated Chunk Speed (km/h; synthetic)` (continuous float, km/h).
  2. `Observed Chunk Traffic Density (veh/km)` (continuous float; labeled as observed, but physically derived from volume/chunk length ratio).
- **Target Leakage Vectors:** Contains 6 explicit leakage features prefixed with `x_LEAK_` that directly encode the target speed and density.

---

## 4. Verification Matrix

| Evaluation Dimension | Dumas Trajectory (`.xlsx`) | Bengaluru Traffic (`.csv`) | ChunkFlow Before (`.csv`) | ChunkFlow After (`.csv`) |
|---|---|---|---|---|
| **Rows** | 59,614 | 8,936 | 44,680 | 44,680 |
| **Columns** | 9 | 16 | 30 | 26 |
| **Missing Values** | 0 (0.0%) | 0 (0.0%) | 11,070 (Weather Index) | 0 (0.0%) |
| **Duplicates** | 0 | 0 | 0 | 0 |
| **Sampling Frequency** | 0.5 seconds | Daily (1/day) | Synthetic Chunk | Synthetic Chunk |
| **True Target Observability** | Observed video speed | Daily average speed | Synthetic chunk speed | Synthetic chunk speed & density |
| **Network Graph Support** | No (Single 535m midblock) | Yes (16 corridors) | Yes (16 corridors × 5 chunks) | Yes (16 corridors × 5 chunks) |
| **Routing Utility Potential** | Micro-speed dynamics only | Macro routing guidance | Segment routing demonstration | Segment routing demonstration |
