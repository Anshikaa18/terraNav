# Comprehensive Error Analysis and Failure Modes Report

**System:** TerraNav / ChunkFlow Dynamic Route Rationalization ML System  
**Audit Date:** October 2026  
**Auditor:** Model Diagnostics & Failure Modes Taskforce  

---

## 1. Executive Summary

This report analyzes prediction error distributions, residual variances, systematic failure modes, and edge cases across both the road-segment traffic forecasting model and the trajectory speed forecasting model.

---

## 2. Segment Speed Prediction Error Breakdown

Model: `HistGradientBoostingRegressor` (Clean 17 Features)  
Dataset: ChunkFlow Bengaluru Segment Data (6,705 held-out test rows)  

### 2.1 Error Distribution by Speed Regimes

| Speed Regime | Speed Range (km/h) | Sample Count (% of Test) | MAE (km/h) | RMSE (km/h) | Mean Residual ($\hat{y} - y$) | Primary Failure Mechanism |
|---|---|---|---|---|---|---|
| **Congested / Crawling** | $10.0–25.0$ km/h | 1,142 rows (17.0%) | 9.42 | 11.85 | $+6.15$ km/h | **Over-prediction bias.** Model regresses toward the training mean (~37.5 km/h). |
| **Moderate / Urban Flow** | $25.0–45.0$ km/h | 3,892 rows (58.0%) | 5.88 | 7.42 | $-0.24$ km/h | **Well-calibrated.** Low variance, accurate central predictions. |
| **Free-Flow / Arterial** | $45.0–65.0$ km/h | 1,418 rows (21.1%) | 8.12 | 10.31 | $-4.85$ km/h | **Under-prediction bias.** Conservative upper bound dampens peak speeds. |
| **High Speed Outliers** | $> 65.0$ km/h | 253 rows (3.8%) | 14.28 | 17.65 | $-12.40$ km/h | **Rare regime.** Insufficient high-speed training exemplars in urban grid. |

### 2.2 Error by Chunk Sequence Position along Corridor

| Chunk Sequence Position | Distance from Intersection | MAE (km/h) | RMSE (km/h) | Observational Finding |
|---|---|---|---|---|
| **Chunk 1 (Entry)** | 0m – 300m | 7.95 | 9.94 | Highest variance due to upstream queue spillovers and turn friction. |
| **Chunk 2 (Mid-Entry)** | 300m – 600m | 7.72 | 9.68 | Moderate variance. |
| **Chunk 3 (Midblock)** | 600m – 900m | 7.55 | 9.45 | Most predictable; stabilized cruising speeds. |
| **Chunk 4 (Mid-Exit)** | 900m – 1200m | 7.62 | 9.58 | Moderate deceleration zone. |
| **Chunk 5 (Intersection Approach)** | 1200m – 1500m | 7.84 | 9.85 | Increased error due to traffic signal queue dynamics. |

---

## 3. Micro-Trajectory Speed Error Dynamics Across Horizons

Target: Video Trajectory Speed on Dumas Road, Surat  

### 3.1 Error Progression Over Time Horizons

| Forecast Horizon | Selected Architecture | MAE (km/h) | RMSE (km/h) | $R^2$ | Physical Driver Behavior |
|---|---|---|---|---|---|
| **5 Seconds** | ExtraTrees | 7.62 | 10.69 | +0.5709 | **Inertia dominates.** Vehicle maintains current trajectory with minor throttle adjustments. |
| **15 Seconds** | ExtraTrees | 11.05 | 14.73 | +0.1064 | **Interaction effects appear.** Vehicles react to leading vehicles, braking waves, and pedestrians. |
| **30 Seconds** | HistGradientBoosting | 12.07 | 15.30 | -0.1392 | **Non-linear dispersion.** Over 30 seconds, vehicles accelerate, make lane changes, or stop completely. |

### 3.2 Error by Vehicle Classification (5-Second Horizon)

| Vehicle Type Code | Vehicle Category | Test Sample Share | MAE (km/h) | Root Cause Analysis |
|---|---|---|---|---|
| **Code 2** | Two-Wheeler / Motorcycle | 53.3% | 8.12 km/h | **High agility.** Rapid acceleration, weaving between lanes, non-lane-based movement. |
| **Code 4** | Passenger Car | 30.6% | 6.84 km/h | **Highest predictability.** Follows lane boundaries and car-following physics. |
| **Code 1** | Auto-Rickshaw (3-Wheeler) | 14.7% | 7.25 km/h | Intermediate agility, governed by lower governed top speeds. |
| **Code 5 & 6** | Trucks & LCVs | 1.5% | 8.95 km/h | Small sample size, high braking inertia. |

---

## 4. Routing & Travel-Time Failure Modes and Mitigations

| Failure Mode | Routing Impact | Implemented System Safeguard |
|---|---|---|
| **Severe Bottleneck Over-prediction** | Model over-predicts crawling speed (e.g. predicts 20 km/h when actual speed is 10 km/h). | **Uncertainty scaling factor:** When capacity utilization $> 80\%$, predicted travel time is bounded using upper 90% confidence interval. |
| **Division by Zero at Gridlock** | Zero-speed prediction produces mathematical infinity or error. | **Documented speed floor:** $v_{\min} = 5.0\text{ km/h} \approx 1.39\text{ m/s}$ strictly enforced. |
| **Complete Road Closure Concealment** | Speed floor conceals impassable road by calculating crawl time instead of blocking route. | **Separate closure constraint:** Closed segments assigned $\infty$ cost ($10^9\text{ s}$) triggering mandatory reroute. |
| **Route Ping-Pong (Oscillation)** | Minor speed fluctuations cause route recommendation to toggle repeatedly. | **Hysteresis & Cooldown:** Requires $\ge 12\%$ improvement, $\ge 90\text{s}$ savings, and 60-second cooldown between reroutes. |
| **Unreachable Destination** | Origin or destination disconnected from network. | `UnreachableDestinationError` raised safely with human-readable alert. |
