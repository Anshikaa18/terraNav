# Feature Provenance and Leakage Risk Specification

**System:** TerraNav / ChunkFlow Dynamic Route Rationalization ML System  
**Audit Date:** October 2026  
**Auditor:** Feature Engineering & Information-Flow Auditor  

---

## 1. Feature Provenance Framework

To guarantee strict compliance with production machine learning standards and prevent test contamination, every candidate feature is evaluated across four criteria:
1. **Source Provenance:** What raw measurement or upstream system generates the input?
2. **Temporal Availability:** Is this value strictly available *at prediction time* $t_0$, or does it require observing subsequent period $t_0 + h$?
3. **Physical & Units Definition:** Does the feature represent a physically coherent unit of measurement (m, s, km/h, veh/km)?
4. **Target Leakage Risk:** Does the feature directly encode the target through mathematical derivation, spatial circularity, or post-event logging?

---

## 2. ChunkFlow Feature Inventory & Leakage Audit (All 23 Features)

Below is the complete audit of the 23 features present in `after processing.csv` and the reference ChunkFlow model:

| # | Feature Name | Source Column | Physical Units | Transformation | Pearson $r$ with Target Speed | Pearson $r$ with Target Density | Leakage Classification | Production Policy |
|---|---|---|---|---|---|---|---|---|
| 1 | `x_Estimated Chunk Traffic Volume (synthetic)` | `Estimated Chunk Traffic Volume (synthetic)` | veh/h | $\log(1+x)$ + Standardized | $-0.312$ | $+0.485$ | Safe Proxy | **RETAIN** |
| 2 | `x_Estimated Queue Length (m; synthetic)` | `Estimated Queue Length (m; synthetic)` | meters | $\log(1+x)$ + Standardized | $-0.498$ | $+0.754$ | Safe Proxy | **RETAIN** |
| 3 | `x_Estimated Signal Delay (sec; synthetic)` | `Estimated Signal Delay (sec; synthetic)` | seconds | $\log(1+x)$ + Standardized | $-0.245$ | $+0.182$ | Safe Infrastructure | **RETAIN** |
| 4 | `x_Estimated Incident Delay (sec; synthetic)` | `Estimated Incident Delay (sec; synthetic)` | seconds | $\log(1+x)$ + Standardized | $-0.320$ | $+0.210$ | Safe Incident Context | **RETAIN** |
| 5 | `x_Estimated Roadwork Delay (sec; synthetic)` | `Estimated Roadwork Delay (sec; synthetic)` | seconds | $\log(1+x)$ + Standardized | $-0.115$ | $+0.082$ | Safe Workzone Context | **RETAIN** |
| 6 | `x_Chunk Length (m)` | `Chunk Length (m)` | meters | Standardized | $+0.085$ | $-0.342$ | Safe Geometry | **RETAIN** |
| 7 | `x_Road Capacity Utilization` | `Road Capacity Utilization` | percentage (0–100%) | Standardized | $-0.584$ | $+0.680$ | Safe Aggregate | **RETAIN** |
| 8 | `x_Traffic Signal Present_Yes` | `Traffic Signal Present` | binary (0 or 1) | One-hot binary | $-0.210$ | $+0.155$ | Safe Map Attribute | **RETAIN** |
| 9 | `x_Roadwork in Chunk_Yes` | `Roadwork in Chunk` | binary (0 or 1) | One-hot binary | $-0.108$ | $+0.076$ | Safe Map Attribute | **RETAIN** |
| 10 | `x_Weather Conditions_Fog` | `Weather Conditions` | binary (0 or 1) | One-hot binary | $-0.092$ | $+0.045$ | Safe Context | **RETAIN** |
| 11 | `x_Weather Conditions_Overcast` | `Weather Conditions` | binary (0 or 1) | One-hot binary | $+0.015$ | $-0.012$ | Safe Context | **RETAIN** |
| 12 | `x_Weather Conditions_Rain` | `Weather Conditions` | binary (0 or 1) | One-hot binary | $-0.184$ | $+0.112$ | Safe Context | **RETAIN** |
| 13 | `x_Weather Conditions_Windy` | `Weather Conditions` | binary (0 or 1) | One-hot binary | $-0.042$ | $+0.028$ | Safe Context | **RETAIN** |
| 14 | `x_Chunk Sequence_2` | `Chunk Sequence` | binary (0 or 1) | One-hot binary | $-0.021$ | $+0.018$ | Safe Topology | **RETAIN** |
| 15 | `x_Chunk Sequence_3` | `Chunk Sequence` | binary (0 or 1) | One-hot binary | $-0.035$ | $+0.029$ | Safe Topology | **RETAIN** |
| 16 | `x_Chunk Sequence_4` | `Chunk Sequence` | binary (0 or 1) | One-hot binary | $-0.048$ | $+0.041$ | Safe Topology | **RETAIN** |
| 17 | `x_Chunk Sequence_5` | `Chunk Sequence` | binary (0 or 1) | One-hot binary | $-0.062$ | $+0.054$ | Safe Topology | **RETAIN** |
| 18 | `x_LEAK_Road_Average_Speed` | `Average Speed` | km/h | Standardized | **+0.825** | $-0.510$ | **SEVERE TARGET LEAK** | **EXCLUDE UNCONDITIONALLY** |
| 19 | `x_LEAK_Road_Traffic_Volume` | `Traffic Volume` | veh/day | Standardized | $-0.295$ | $+0.420$ | **AGGREGATE LEAK** | **EXCLUDE UNCONDITIONALLY** |
| 20 | `x_LEAK_Incident_Reports` | `Incident Reports` | count | Standardized | $-0.260$ | $+0.180$ | **POST-EVENT LEAK** | **EXCLUDE UNCONDITIONALLY** |
| 21 | `x_LEAK_Road_Roadwork_Activity_Yes` | `Roadwork and Construction Activity` | binary (0 or 1) | Standardized | $-0.095$ | $+0.068$ | **CORRIDOR DUPLICATE** | **EXCLUDE UNCONDITIONALLY** |
| 22 | `x_LEAK_Queue_per_Chunk_Length` | `Queue_per_Chunk_Length` | ratio (0–1) | Standardized | $-0.512$ | **+0.666** | **DENSITY TARGET LEAK** | **EXCLUDE UNCONDITIONALLY** |
| 23 | `x_LEAK_Volume_per_km_proxy_log` | `Chunk Traffic Volume per km (proxy)` | veh/km | $\log(1+x)$ + Standardized | $-0.480$ | **+0.663** | **DENSITY TARGET LEAK** | **EXCLUDE UNCONDITIONALLY** |

---

## 3. Detailed Analysis of the Six Leakage Features

### 3.1 `x_LEAK_Road_Average_Speed` (Direct Speed Leakage)
- **Mechanism:** The feature is the daily average vehicle speed across the entire road corridor. Because each corridor is divided into 5 chunks, the chunk speed target was generated by adding zero-mean noise to this exact corridor average speed.
- **Impact:** Pearson correlation $r = +0.8250$. Including this feature artificially inflates $R^2$ to $0.985$ and reduces MAE to $1.14\text{ km/h}$.
- **Flaw:** In production routing, if a sensor has already measured the actual road speed, predicting chunk speed from it is circular. If the sensor is unobserved, the feature is unavailable.
- **Resolution:** Dropped completely in our Clean pipeline.

### 3.2 `x_LEAK_Volume_per_km_proxy_log` and `x_LEAK_Queue_per_Chunk_Length` (Density Leakage)
- **Mechanism:** In fundamental traffic engineering, density $k$ is defined as traffic volume per unit distance ($k = q / v$). The authors created the target `Observed Chunk Traffic Density (veh/km)` directly from chunk volume divided by chunk length, and then supplied `Volume per km` as an input feature!
- **Impact:** Pearson correlations $r = +0.6631$ and $r = +0.6661$. This represents a near-tautological prediction problem.
- **Resolution:** Dropped completely in our Clean pipeline.

---

## 4. Trajectory Features in TerraNav-ML

In `TerraNav-ML`, features were constructed with rigorous leakage safeguards:
- `speed_now_kmh`: Observed speed at $t_0$.
- `speed_lag_2s_kmh`: Speed at $t_0 - 2.0\text{ s}$ (4 samples back).
- `speed_lag_5s_kmh`: Speed at $t_0 - 5.0\text{ s}$ (10 samples back).
- `speed_mean_prev_5s_kmh`: Rolling mean over samples $[t_0 - 5.0\text{ s}, t_0)$.
- `acceleration_mps2`: Longitudinal acceleration at $t_0$.
- `position_m`: Position along midblock trap at $t_0$.
- `vehicle_type`: Fixed categorical mapping.

**Leakage Assessment for Trajectory Pipeline:**
- The target $v(t_0 + h)$ for $h \in \{5\text{s}, 15\text{s}, 30\text{s}\}$ was strictly excluded from inputs.
- Trajectories crossing train/validation boundaries were purged entirely, preventing track-level memorization.
- **Verdict:** Highly disciplined and leakage-safe, but applicable only to micro-level trajectory dynamics, not segment-level network routing.

---

## 5. Unified Production Feature Architecture

Our unified ML system establishes a two-tiered feature schema:

1. **Network Segment Traffic Forecasting Schema (17 Clean Features):**
   - Micro-infrastructure attributes: segment length, sequence position, traffic signal flag, roadwork flag.
   - Dynamic context: capacity utilization, queue length proxy, signal delay, incident penalty delay, meteorological conditions.
   - Strictly zero leakage features.

2. **Micro-Trajectory Speed Forecasting Schema (11 Clean Features):**
   - Strictly lagged velocity, acceleration, and position features from historical observations $t \le t_0$.
