# Model Evaluation and Multi-Regime Generalization Report

**System:** TerraNav / ChunkFlow Dynamic Route Rationalization ML System  
**Audit Date:** October 2026  
**Evaluation Standard:** Independent Validation & Out-of-Distribution Protocol  

---

## 1. Executive Summary

This report documents the rigorous evaluation of road-segment traffic prediction models and micro-trajectory speed forecasting models across multiple candidate architectures, prediction horizons, and split regimes.

### Key Empirical Findings:
1. **Target Leakage Exposed:**
   - In the reference ChunkFlow implementation, inclusion of `x_LEAK_Road_Average_Speed` produced an artificial test $R^2$ of **0.9854** and MAE of **1.14 km/h**.
   - When all 6 leakage features were strictly removed, the clean 17-feature model achieved $R^2 = \mathbf{0.3721}$ and MAE of $\mathbf{7.71\text{ km/h}}$.
   - Despite this expected drop, the clean model substantially outperforms the Dummy Mean Baseline ($\text{MAE} = 9.98\text{ km/h}$) by **22.7%**, confirming legitimate signal from capacity utilization, queue length proxies, signals, sequence positions, and weather conditions.
2. **True Generalization Confirmed Across Space and Time:**
   - **Spatial Holdout (Regime B - 4 Unseen Corridors):** Clean HGBR achieves $\text{MAE} = \mathbf{8.15\text{ km/h}}$ vs. Dummy baseline $\text{MAE} = 10.63\text{ km/h}$ (23.3% improvement).
   - **Chronological Holdout (Regime C - Future Dates $\ge$ 2024-01-01):** Clean HGBR achieves $\text{MAE} = \mathbf{7.72\text{ km/h}}$ vs. Dummy baseline $\text{MAE} = 9.99\text{ km/h}$ (22.7% improvement).
3. **Trajectory Speed Forecasting Across Horizons (Dumas Road):**
   - At **5 seconds**: Selected ExtraTrees model achieves $\text{MAE} = \mathbf{7.62\text{ km/h}}$ ($R^2 = 0.571$) vs. Persistence $\text{MAE} = 10.20\text{ km/h}$ (25.3% error reduction).
   - At **15 seconds**: ExtraTrees achieves $\text{MAE} = \mathbf{11.05\text{ km/h}}$ ($R^2 = 0.106$) vs. Persistence $\text{MAE} = 15.59\text{ km/h}$ (29.2% error reduction).
   - At **30 seconds**: Selected HistGradientBoosting achieves $\text{MAE} = \mathbf{12.07\text{ km/h}}$ vs. Persistence $\text{MAE} = 17.31\text{ km/h}$ (30.3% error reduction). The negative $R^2 = -0.139$ honestly reflects that while tree models outperform persistence, vehicle speed exhibits severe non-linear dispersion over 30s in mixed urban Indian traffic.

---

## 2. Road-Segment Traffic Speed Forecasting (Bengaluru / ChunkFlow Dataset)

Target Variable: `Estimated Chunk Speed (km/h; synthetic)`  
Dataset Size: 44,680 rows across 16 arterial corridors  

### 2.1 Multi-Model Performance Across Split Regimes

| Evaluation Regime | Candidate Architecture | Test MAE (km/h) | Test RMSE (km/h) | MedAE (km/h) | Test $R^2$ | MAPE (%) | Fit Time (s) |
|---|---|---|---|---|---|---|---|
| **Regime A (Standard Split)** | Dummy Mean Baseline | 9.98 | 12.20 | 8.81 | -0.0001 | 31.51 | 0.00 |
| | Ridge Linear Regressor | 7.79 | 9.74 | 6.59 | 0.3623 | 23.35 | 0.03 |
| | **HistGradientBoosting (Clean)** | **7.71** | **9.67** | **6.54** | **0.3721** | **23.08** | **7.65** |
| | ExtraTrees Regressor | 7.82 | 9.82 | 6.62 | 0.3521 | 23.35 | 8.86 |
| **Regime B (Unseen Corridors)** | Dummy Mean Baseline | 10.63 | 13.23 | 9.14 | -0.1161 | 27.52 | 0.00 |
| *(Silk Board, Hosur Rd,* | Ridge Linear Regressor | 8.07 | 10.24 | 6.65 | 0.3309 | 22.02 | 0.02 |
| *ITPL, Tumkur Rd held out)* | **HistGradientBoosting (Clean)** | **8.15** | **10.38** | **6.69** | **0.3124** | **21.95** | **0.55** |
| | ExtraTrees Regressor | 8.17 | 10.40 | 6.72 | 0.3105 | 22.25 | 9.58 |
| **Regime C (Chronological)** | Dummy Mean Baseline | 9.99 | 12.31 | 8.79 | -0.0000 | 31.82 | 0.00 |
| *(Train: 2022–2023,* | Ridge Linear Regressor | 7.78 | 9.89 | 6.34 | 0.3546 | 23.54 | 0.01 |
| *Test: 2024-01-01 to 08-09)* | **HistGradientBoosting (Clean)** | **7.72** | **9.84** | **6.29** | **0.3609** | **23.28** | **0.99** |
| | ExtraTrees Regressor | 7.87 | 10.02 | 6.41 | 0.3375 | 23.65 | 8.91 |

---

### 2.2 Leakage Ablation Analysis

| Configuration | Features Used | Test MAE (km/h) | Test RMSE (km/h) | Test $R^2$ | MAPE (%) | Leakage Status |
|---|---|---|---|---|---|---|
| **Leaky Pipeline** | All 23 Features (includes `x_LEAK_*`) | 1.14 | 1.48 | 0.9854 | 3.16% | **FATAL LEAKAGE** |
| **Production Clean** | 17 Verified Features (Zero `x_LEAK_*`) | 7.71 | 9.67 | 0.3721 | 23.08% | **STRICTLY CLEAN** |
| **Dummy Baseline** | Zero Features (Historical Training Mean) | 9.98 | 12.20 | -0.0001 | 31.51% | No signal |

---

## 3. Micro-Trajectory Speed Forecasting (Dumas Road Dataset)

Target: Vehicle Longitudinal Speed Magnitude in km/h  
Observation Geometry: 535m midblock on Dumas Road, Surat (702 tracks, 0.5s sampling)  
Splitting Protocol: Chronological with split-boundary trajectory purging  

| Horizon | Candidate Model | Train / Val / Test Samples | Test MAE (km/h) | Test RMSE (km/h) | Test $R^2$ | Persistence MAE | Error Reduction vs Persistence |
|---|---|---|---|---|---|---|---|
| **5 Seconds** | Persistence Baseline | 27,044 / 7,459 / 7,177 | 10.20 | 14.13 | 0.2505 | 10.20 | 0.0% |
| | Rolling 5s Mean | 27,044 / 7,459 / 7,177 | 11.24 | 15.07 | 0.1469 | 10.20 | -10.2% |
| | HistGradientBoosting | 27,044 / 7,459 / 7,177 | 8.75 | 11.85 | 0.4726 | 10.20 | +14.2% |
| | **ExtraTrees (Selected)** | **27,044 / 7,459 / 7,177** | **7.62** | **10.69** | **0.5709** | **10.20** | **+25.3%** |
| **15 Seconds** | Persistence Baseline | 20,224 / 5,477 / 5,206 | 15.59 | 20.47 | -0.7249 | 15.59 | 0.0% |
| | Rolling 5s Mean | 20,224 / 5,477 / 5,206 | 16.26 | 21.03 | -0.8213 | 15.59 | -4.3% |
| | HistGradientBoosting | 20,224 / 5,477 / 5,206 | 13.15 | 17.02 | -0.1928 | 15.59 | +15.7% |
| | **ExtraTrees (Selected)** | **20,224 / 5,477 / 5,206** | **11.05** | **14.73** | **0.1064** | **15.59** | **+29.2%** |
| **30 Seconds** | Persistence Baseline | 11,025 / 2,811 / 2,717 | 17.31 | 21.86 | -1.3254 | 17.31 | 0.0% |
| | Rolling 5s Mean | 11,025 / 2,811 / 2,717 | 17.41 | 21.89 | -1.3302 | 17.31 | -0.6% |
| | **HistGradientBoosting (Selected)** | **11,025 / 2,811 / 2,717** | **12.07** | **15.30** | **-0.1392** | **17.31** | **+30.3%** |
| | ExtraTrees | 11,025 / 2,811 / 2,717 | 12.19 | 15.22 | -0.1270 | 17.31 | +29.6% |

---

## 4. Serving Latency & Computational Profile

Measured on local Python 3.12 runtime with 30 warmed evaluation batches:

| Batch Size | Median Latency (ms) | p95 Latency (ms) | p99 Latency (ms) | Throughput (rows/sec) |
|---|---|---|---|---|
| **1 segment** | 7.16 ms | 20.42 ms | 22.23 ms | 139.7 rows/s |
| **16 segments** | 6.84 ms | 8.15 ms | 8.91 ms | 2,339.3 rows/s |
| **64 segments** | 7.01 ms | 10.13 ms | 10.57 ms | 9,126.7 rows/s |
| **256 segments** | 8.36 ms | 21.74 ms | 77.91 ms | 30,612.9 rows/s |

**Artifact Dimensions:**
- `production_segment_speed_model.joblib`: **235.5 KB** (lightweight compressed gradient-boosted tree bundle).
- `production_trajectory_speed_5s.joblib`: 36.4 MB.
- `production_trajectory_speed_15s.joblib`: 21.7 MB.
- `production_trajectory_speed_30s.joblib`: 1.2 MB.
