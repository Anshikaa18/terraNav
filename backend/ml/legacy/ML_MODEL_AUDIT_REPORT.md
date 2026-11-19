# ChunkFlow ML Model Audit & Validation Report

**Model Version:** `ChunkFlow-v1.0-HGBR`  
**Model Architecture:** Scikit-Learn `HistGradientBoostingRegressor` (MultiOutput / Independent Pipelines) wrapped with `SimpleImputer(strategy='mean')`  
**Dataset:** 44,680 total rows across 16 road corridors and 952 observation dates (2022-01-01 to 2024-08-09)  
**Evaluation Date:** October 2026  

---

## 1. Feature Dictionary (All 23 Input Features)

The ChunkFlow model ingests 23 preprocessed numeric and one-hot features. Below is the complete specification including raw source columns, units, transformation methods, and computation formulas.

| # | Feature Name | Raw Source Column | Data Type & Units | Preprocessing Transformation | Source & Physical Formula |
|---|---|---|---|---|---|
| 1 | `x_Estimated Chunk Traffic Volume (synthetic)` | `Estimated Chunk Traffic Volume (synthetic)` | Float (vehicles/hour) | `log1p` then Standardized ($\mu=6.26, \sigma=0.76$) | Inferred from road capacity & ratio $(1 - v/v_{\text{free}}) \times 1000$ |
| 2 | `x_Estimated Queue Length (m; synthetic)` | `Estimated Queue Length (m; synthetic)` | Float (meters) | `log1p` then Standardized ($\mu=4.14, \sigma=1.28$) | Synthetic queue proxy $(1 - v/v_{\text{free}}) \times L_{\text{chunk}}$ |
| 3 | `x_Estimated Signal Delay (sec; synthetic)` | `Estimated Signal Delay (sec; synthetic)` | Float (seconds) | `log1p` then Standardized ($\mu=0.98, \sigma=1.57$) | Static estimate: $25\text{s}$ if traffic light present, else $0\text{s}$ |
| 4 | `x_Estimated Incident Delay (sec; synthetic)` | `Estimated Incident Delay (sec; synthetic)` | Float (seconds) | `log1p` then Standardized ($\mu=0.48, \sigma=1.49$) | Inferred bottleneck delay: $180\text{s}$ to $480\text{s}$ depending on incident |
| 5 | `x_Estimated Roadwork Delay (sec; synthetic)` | `Estimated Roadwork Delay (sec; synthetic)` | Float (seconds) | `log1p` then Standardized ($\mu=0.04, \sigma=0.42$) | Synthetic construction delay |
| 6 | `x_Chunk Length (m)` | `Chunk Length (m)` | Float (meters) | Standardized ($\mu=362.4, \sigma=77.8$) | Spatial polyline split distance (nominal 200–500m chunks) |
| 7 | `x_Road Capacity Utilization` | `Road Capacity Utilization` | Float (percentage 0–100%) | Standardized ($\mu=62.3, \sigma=22.1$) | Congestion metric $(1 - v/v_{\text{free}}) \times 100$ |
| 8 | `x_Traffic Signal Present_Yes` | `Traffic Signal Present` | Binary (0 or 1) | One-hot indicator | OSM tag or road attribute (`highway=traffic_signals`) |
| 9 | `x_Roadwork in Chunk_Yes` | `Roadwork in Chunk` | Binary (0 or 1) | One-hot indicator | Active construction flag |
| 10 | `x_Weather Conditions_Fog` | `Weather Conditions` | Binary (0 or 1) | One-hot indicator | Meteorological conditions |
| 11 | `x_Weather Conditions_Overcast` | `Weather Conditions` | Binary (0 or 1) | One-hot indicator | Meteorological conditions |
| 12 | `x_Weather Conditions_Rain` | `Weather Conditions` | Binary (0 or 1) | One-hot indicator | Meteorological conditions |
| 13 | `x_Weather Conditions_Windy` | `Weather Conditions` | Binary (0 or 1) | One-hot indicator | Meteorological conditions |
| 14 | `x_Chunk Sequence_2` | `Chunk Sequence` | Binary (0 or 1) | One-hot indicator | Segment index along corridor = 2 |
| 15 | `x_Chunk Sequence_3` | `Chunk Sequence` | Binary (0 or 1) | One-hot indicator | Segment index along corridor = 3 |
| 16 | `x_Chunk Sequence_4` | `Chunk Sequence` | Binary (0 or 1) | One-hot indicator | Segment index along corridor = 4 |
| 17 | `x_Chunk Sequence_5` | `Chunk Sequence` | Binary (0 or 1) | One-hot indicator | Segment index along corridor = 5 |
| 18 | `x_LEAK_Road_Average_Speed` | `Average Speed` | Float (km/h) | Standardized ($\mu=48.2, \sigma=13.6$) | **TARGET LEAK:** Road-wide average vehicle speed |
| 19 | `x_LEAK_Road_Traffic_Volume` | `Traffic Volume` | Float (vehicles/hour) | Standardized ($\mu=1240.5, \sigma=410.2$) | **LEAK:** Road-wide total vehicle flow |
| 20 | `x_LEAK_Incident_Reports` | `Incident Reports` | Integer count | Standardized ($\mu=0.18, \sigma=0.45$) | Historical incident occurrences |
| 21 | `x_LEAK_Road_Roadwork_Activity_Yes` | `Roadwork and Construction Activity` | Binary (0 or 1) | Standardized ($\mu=0.08, \sigma=0.27$) | Road-wide active construction flag |
| 22 | `x_LEAK_Queue_per_Chunk_Length` | `Queue_per_Chunk_Length` | Float (ratio 0–1) | Standardized ($\mu=0.24, \sigma=0.18$) | **TARGET LEAK:** $\frac{\text{Queue Length}}{\text{Chunk Length}}$ |
| 23 | `x_LEAK_Volume_per_km_proxy_log` | `Chunk Traffic Volume per km (proxy)` | Float (veh/km proxy) | `log1p` then Standardized ($\mu=6.84, \sigma=0.74$) | **TARGET LEAK:** $\frac{\text{Estimated Chunk Volume}}{\text{Chunk Length (km)}}$ |

---

## 2. Target Leakage & Predictive Boundary Analysis

### Identified Leakage Vectors
1. **Direct Speed Leakage (`x_LEAK_Road_Average_Speed`):**
   - Pearson correlation with target `Estimated Chunk Speed (km/h; synthetic)` is **+0.8250**.
   - The road-wide average speed already contains the target chunk speed. In a real-world setting, if a sensor already measures the road's average speed, predicting chunk speed from it is partly circular.
2. **Direct Density Leakage (`x_LEAK_Volume_per_km_proxy_log` and `x_LEAK_Queue_per_Chunk_Length`):**
   - Pearson correlation with target `Observed Chunk Traffic Density (veh/km)` is **+0.6631** and **+0.6661**.
   - `Volume per km` is physically defined as traffic density ($k = q / v$). Using it as an input to predict traffic density creates near-tautological performance.
3. **Queue Length Proxies (`x_Estimated Queue Length (m; synthetic)`):**
   - Correlation with density is **+0.7535**.
   - High queue length directly dictates high vehicle density.

### Inference-Time Safeguards
To make inference safe when real road-sensor metrics are unavailable, the backend `mlAdapter.js` constructs plausible feature inputs derived strictly from available telemetry:
- Live observation speed ratio ($v_{\text{observed}} / v_{\text{free}}$) is used as the proxy base.
- When live observations are missing, safe fallback values (clear weather, 0 incident delay, free-flow speeds) are supplied rather than unvalidated random values.

---

## 3. Evaluation Split Regimes

To audit model generalisability and address the known limitations of random row-level splitting, we evaluated across three distinct regimes:

- **Regime A — Original Repository Split (Random Row Split):**
  - Train: 31,270 rows (70.0%)
  - Test: 6,705 rows (15.0%)
  - *Limitation:* 100% corridor and date overlap between train and test sets.
- **Regime B — Corridor-Held-Out Evaluation (Spatial Holdout):**
  - Train: 37,865 rows (84.7%) on 12 corridors.
  - Test: 6,815 rows (15.3%) on 4 unseen corridors: *Silk Board Junction, Hosur Road, ITPL Main Road, Tumkur Road*.
  - *Purpose:* Evaluates transferability to completely unseen road corridors.
- **Regime C — Chronological Evaluation (Temporal Holdout):**
  - Train: 34,185 rows (76.5%) with dates strictly before `2024-01-01` (2022-01-01 to 2023-12-31).
  - Test: 10,495 rows (23.5%) with dates strictly on or after `2024-01-01` (2024-01-01 to 2024-08-09).
  - *Purpose:* Evaluates forecasting ability into the future without temporal leakage.

---

## 4. Quantitative Results & Baselines Comparison

All models were evaluated against:
1. **DummyRegressor (Mean Baseline):** Predicts the training set target mean for all test rows.
2. **Ridge Linear Model:** Linear L2-regularized baseline.
3. **ChunkFlow HistGradientBoostingRegressor (All 23 Features):** Full pipeline with all features.
4. **ChunkFlow HistGradientBoostingRegressor (Clean 17 Features):** Production pipeline with the 6 `x_LEAK_` features removed.

### Target 1: `Observed Chunk Traffic Density (veh/km)`
- *Dataset Statistics:* Mean = $50.32\text{ veh/km}$, Std = $29.38\text{ veh/km}$

| Split Regime | Model Configuration | $R^2$ Score | MAE (veh/km) | RMSE (veh/km) |
|---|---|---|---|---|
| **Regime A (Random Split)** | Dummy Mean Baseline | -0.0002 | 24.22 | 29.38 |
| | Ridge Linear (All 23) | 0.9333 | 5.88 | 7.59 |
| | **HGBR (All 23)** | **0.9414** | **5.49** | **7.11** |
| | **HGBR (Clean 17 — No Leak)** | **0.6978** | **12.97** | **16.15** |
| **Regime B (Unseen Corridors)** | Dummy Mean Baseline | -0.5558 | 27.10 | 31.82 |
| | **HGBR (All 23)** | **0.9419** | **4.73** | **6.15** |
| | **HGBR (Clean 17 — No Leak)** | **0.6561** | **11.79** | **14.96** |
| **Regime C (Chronological 2024)** | Dummy Mean Baseline | -0.0000 | 24.28 | 29.54 |
| | **HGBR (All 23)** | **0.9411** | **5.53** | **7.17** |
| | **HGBR (Clean 17 — No Leak)** | **0.6916** | **13.00** | **16.40** |

---

### Target 2: `Estimated Chunk Speed (km/h; synthetic)`
- *Dataset Statistics:* Mean = $42.15\text{ km/h}$, Std = $12.20\text{ km/h}$

| Split Regime | Model Configuration | $R^2$ Score | MAE (km/h) | RMSE (km/h) |
|---|---|---|---|---|
| **Regime A (Random Split)** | Dummy Mean Baseline | -0.0001 | 9.98 | 12.20 |
| | Ridge Linear (All 23) | 0.9670 | 1.70 | 2.22 |
| | **HGBR (All 23)** | **0.9853** | **1.14** | **1.48** |
| | **HGBR (Clean 17 — No Leak)** | **0.3730** | **7.71** | **9.66** |
| **Regime B (Unseen Corridors)** | Dummy Mean Baseline | -0.1161 | 10.63 | 13.23 |
| | **HGBR (All 23)** | **0.9826** | **1.26** | **1.65** |
| | **HGBR (Clean 17 — No Leak)** | **0.3072** | **8.19** | **10.42** |
| **Regime C (Chronological 2024)** | Dummy Mean Baseline | -0.0000 | 9.99 | 12.31 |
| | **HGBR (All 23)** | **0.9853** | **1.13** | **1.49** |
| | **HGBR (Clean 17 — No Leak)** | **0.3646** | **7.69** | **9.81** |

---

## 5. Key Findings & Scientific Conclusions

1. **Target Leakage Explains the Near-Perfect $R^2 \approx 0.985$:**
   - Inclusion of `x_LEAK_Road_Average_Speed` elevates speed prediction $R^2$ to $0.985$ with an error of just $1.14\text{ km/h}$.
   - When the 6 leakage features are removed, the clean model achieves $R^2 \approx 0.31 - 0.37$ with $\text{MAE} \approx 7.7 - 8.2\text{ km/h}$.
   - The clean model still clearly beats the dummy baseline ($\text{MAE} = 10.0 - 10.6\text{ km/h}$) by ~25%, confirming legitimate signal from chunk length, capacity utilization, signals, weather, and sequence position.

2. **Density Prediction Retains Strong Signal Without Direct Leakage:**
   - Even without leakage features, the clean density model achieves $R^2 \approx 0.66 - 0.70$ with $\text{MAE} \approx 11.8 - 13.0\text{ veh/km}$ (compared to Dummy baseline error of $\approx 24.2 - 27.1\text{ veh/km}$).
   - This indicates queue length and capacity utilization remain strong physical indicators of vehicle concentration.

3. **Generalisation Across Unseen Corridors & Future Dates:**
   - Performance on unseen corridors (Regime B) and future dates (Regime C) is very close to random-split performance (Regime A), proving that the learned patterns are not merely memorising road names or date strings.

4. **Synthetic Target Transparency:**
   - The target `Estimated Chunk Speed (km/h; synthetic)` is synthetic, derived from simulation formulas. The model must not be claimed as real-world validated until evaluated against external loop detectors or GPS probe datasets.
