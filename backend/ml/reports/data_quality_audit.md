# Data Quality and Integrity Audit Report

**System:** TerraNav / ChunkFlow Dynamic Route Rationalization ML System  
**Audit Date:** October 2026  
**Auditor:** ML Validation & Quality Assurance Engine  

---

## 1. Quality Audit Summary

All 4 data assets were evaluated against six rigorous data quality dimensions:
1. **Completeness:** Absence of missing or null fields.
2. **Uniqueness:** Absence of duplicate rows, duplicate track/time coordinates, or duplicate corridor/timestamp pairs.
3. **Physical Validity:** Boundedness of numeric quantities (e.g. speeds, accelerations, queue lengths, coordinates).
4. **Temporal Consistency:** Monotonic progression of timestamps without backward jumps or irregular jitter.
5. **Spatial Consistency:** Preservation of road length bounds, corridor alignment, and coordinate constraints.
6. **Provenance Integrity:** Separation of observed physical sensors from synthetic simulation outputs.

---

## 2. In-Depth Dataset Quality Findings

### 2.1 Dumas Road Trajectory Quality Audit
- **Preamble and Header Structure:** The raw Excel file contains 23 narrative preamble rows before the tabular data. Reading the file with default parameters (`skiprows=0`) produces an invalid 1-column header. Clean ingestion requires specifying `header=23`.
- **Completeness:** Excellent. 59,614 non-null numeric rows across all 9 columns. Missing cell count = $0$.
- **Uniqueness:** $100\%$ unique `(Vehicle No., Time (s))` composite keys. Zero duplicate observations exist.
- **Temporal Interval Consistency:** Exactly $0.500\text{ s}$ across $100\%$ of within-track successive records. No interval jitter detected.
- **Speed Anomaly Analysis (Physical Validity):**
  - Signed longitudinal speed ranges from $-13.34\text{ m/s}$ to $+30.05\text{ m/s}$ ($-48.0\text{ km/h}$ to $+108.2\text{ km/h}$).
  - **Negative Speeds:** There are exactly 1,568 rows ($2.63\%$) with negative longitudinal velocity. These occur when vehicles maneuver backward, experience coordinate flipping near camera edges, or travel counter to the primary camera vector.
  - **Zero Speeds:** Exactly 308 rows ($0.52\%$) exhibit zero longitudinal velocity (stationary queued vehicles at the entry or midblock).
  - **Physical Transformation Rule:** In our production data pipeline, vehicle speed magnitude is computed as $|v_{\text{longitudinal}}| \times 3.6$ to represent true physical scalar velocity in $\text{km/h}$. The negative sign is preserved as a separate directional feature, preventing artificial data destruction while maintaining valid travel-time denominators.
- **Vehicle Type Distribution:**
  - Code 1 (Auto-rickshaw): 8,768 observations ($14.71\%$)
  - Code 2 (Two-wheeler / Bike): 31,749 observations ($53.26\%$)
  - Code 3 (Bus): 0 observations ($0.00\%$) — noted in preamble table, but absent from actual rows.
  - Code 4 (Car): 18,223 observations ($30.57\%$)
  - Code 5 (Truck): 598 observations ($1.00\%$)
  - Code 6 (Light Commercial Vehicle): 276 observations ($0.46\%$)
- **Tracking Accuracy Caution:** The author's preamble notes: *"Overall including miss-stitches and unstitches, the data is about 85 per cent accurate."* This creates label noise in multi-camera boundary transitions that any ML model must tolerate.

---

### 2.2 Bengaluru Traffic Dataset Quality Audit
- **Completeness:** $100\%$ complete. All 8,936 rows have values across all 16 columns.
- **Uniqueness:** Zero duplicate `(Date, Road/Intersection Name)` pairs.
- **Temporal Regularity:** Every day from `2022-01-01` to `2024-08-09` (952 days) contains between 4 and 15 road observations.
- **Speed & Volume Distribution:**
  - `Average Speed`: Mean = $39.45\text{ km/h}$, Std = $10.71\text{ km/h}$, Min = $20.00\text{ km/h}$, Max = $89.79\text{ km/h}$.
  - `Traffic Volume`: Mean = $29,236\text{ veh/day}$, Min = $4,233$, Max = $72,039$.
  - `Road Capacity Utilization`: Ranges from $15.0\%$ to $98.0\%$.
- **Synthetic Distribution Fingerprints:**
  - The dataset exhibits an unnaturally smooth bell curve across `Average Speed` and `Traffic Volume` with virtually zero sensor dropouts, missing dates, or calibration spikes typical of physical inductive loops or SCATS detectors in Indian urban corridors.
  - There are no sub-daily timestamps (no AM/PM peak hour markers).
  - Therefore, while it provides a multi-corridor benchmark, it **cannot be claimed as real-world sensor ground truth**.

---

### 2.3 ChunkFlow Before & After Processing Quality Audit
- **Synthesized Fields:**
  - `Estimated Chunk Speed (km/h; synthetic)`: Mean = $37.49\text{ km/h}$, Min = $10.62\text{ km/h}$, Max = $90.00\text{ km/h}$.
  - `Chunk Length (m)`: Mean = $268.99\text{ m}$, Min = $120.0\text{ m}$, Max = $460.0\text{ m}$.
  - All chunk sequences run 1 through 5 per road.
- **Missing Values:**
  - In `before processing.csv`, `Weather_Severity_Index` contains 11,070 missing values ($24.78\%$).
  - In `after processing.csv`, all missing values were imputed using mean substitution, and weather conditions were expanded into one-hot binary columns (`x_Weather Conditions_Fog`, `Overcast`, `Rain`, `Windy`).
- **Target Representation:**
  - Target 1: `Estimated Chunk Speed (km/h; synthetic)`
  - Target 2: `Observed Chunk Traffic Density (veh/km)`. Note: Despite being named "Observed", this value is calculated from the proxy ratio of chunk volume to chunk length ($k = q / v$).

---

## 3. Data Quality Matrix

| Check Name | Target Dataset | Test Criterion | Observed Result | Status |
|---|---|---|---|---|
| **CHK-DUMAS-01** | `Trajectorydatadumasroad.xlsx` | Non-null rows after header | 59,614 / 59,614 non-null | **PASSED** |
| **CHK-DUMAS-02** | `Trajectorydatadumasroad.xlsx` | Sampling interval consistency | Strictly 0.5s across all tracks | **PASSED** |
| **CHK-DUMAS-03** | `Trajectorydatadumasroad.xlsx` | Negative speed handling | 1,568 rows flagged & transformed | **MITIGATED** |
| **CHK-BLR-01** | `Banglore_traffic_Dataset.csv` | Missing value audit | 0 nulls across 8,936 rows | **PASSED** |
| **CHK-BLR-02** | `Banglore_traffic_Dataset.csv` | Date/Corridor uniqueness | 0 duplicate records | **PASSED** |
| **CHK-BLR-03** | `Banglore_traffic_Dataset.csv` | Intraday timestamp availability | Absent (daily aggregate only) | **RESTRICTION** |
| **CHK-CF-01** | `before processing.csv` | Chunk sequence completeness | 1 to 5 per road (44,680 rows) | **PASSED** |
| **CHK-CF-02** | `after processing.csv` | Leakage feature tagging | 6 `x_LEAK_` features identified | **FLAGGED FOR REMOVAL** |
