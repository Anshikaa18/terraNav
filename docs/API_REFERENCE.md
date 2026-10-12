# TerraNav AI — API Reference Documentation

**Member 3: Backend Integration, Microservices & Data Layer**  
**Version:** 1.0.0  
**Base URL:** `http://localhost:5000/api`  
**Authentication Scheme:** `Authorization: Bearer <JWT_TOKEN>`

---

## Table of Contents
1. [Health Endpoint](#1-health-endpoint)
2. [Authentication APIs](#2-authentication-apis)
3. [Saved Places APIs](#3-saved-places-apis)
4. [Route History APIs](#4-route-history-apis)
5. [Incident APIs](#5-incident-apis)
6. [Dynamic Directions Integration API](#6-dynamic-directions-integration-api)
7. [External Geospatial & POI Services](#7-external-geospatial--poi-services)
8. [Error Responses & Status Codes](#8-error-responses--status-codes)

---

## 1. Health Endpoint

### `GET /api/health`
Checks backend gateway status, database pool connectivity mode, and integration adapters.

- **Auth Required:** No
- **Success Status:** `200 OK`
- **Response Sample:**
```json
{
  "success": true,
  "message": "TerraNav AI Backend API Gateway is fully operational",
  "data": {
    "service": "terranav-backend",
    "status": "healthy",
    "timestamp": "2026-10-06T17:31:37.712Z",
    "uptimeSeconds": 12,
    "database": {
      "database": "terranav_db",
      "host": "127.0.0.1",
      "port": 3306,
      "driver": "mysql2/promise",
      "connected": true,
      "mode": "mysql"
    },
    "integrations": {
      "ml": "REAL (ChunkFlow ML Traffic Predictor)",
      "routing": "REAL (Dynamic Multi-Cost Optimizer)",
      "nominatim": "REAL (OpenStreetMap Geocoder)",
      "overpass": "REAL (OSM POI Engine)",
      "valhalla_osrm": "REAL (Navigation Fallback)"
    }
  }
}
```

---

## 2. Authentication APIs

### `POST /api/auth/register`
Creates a new user profile with bcrypt password hashing and returns an initial JWT.

- **Auth Required:** No
- **Request Body:**
```json
{
  "username": "johndoe",
  "email": "johndoe@terranav.ai",
  "password": "Password123!"
}
```
- **Success Status:** `201 Created`
- **Response Sample:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 2,
      "username": "johndoe",
      "email": "johndoe@terranav.ai"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### `POST /api/auth/login`
Authenticates user email and password against stored bcrypt hash, returning signed JWT.

- **Auth Required:** No
- **Request Body:**
```json
{
  "email": "johndoe@terranav.ai",
  "password": "Password123!"
}
```
- **Success Status:** `200 OK`
- **Response Sample:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 2,
      "username": "johndoe",
      "email": "johndoe@terranav.ai",
      "createdAt": "2026-10-06T17:31:37.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### `GET /api/auth/me`
Retrieves authenticated user profile.

- **Auth Required:** Yes (`Bearer <token>`)
- **Success Status:** `200 OK`
- **Response Sample:**
```json
{
  "success": true,
  "message": "User profile retrieved",
  "data": {
    "user": {
      "id": 2,
      "username": "johndoe",
      "email": "johndoe@terranav.ai",
      "created_at": "2026-10-06T17:31:37.000Z"
    }
  }
}
```

---

## 3. Saved Places APIs

### `GET /api/saved`
Lists all saved places bookmarked by the current user.

- **Auth Required:** Yes (`Bearer <token>`)
- **Success Status:** `200 OK`
- **Response Sample:**
```json
{
  "success": true,
  "message": "Saved places retrieved",
  "data": [
    {
      "id": 1,
      "user_id": 2,
      "name": "MG Road Station",
      "latitude": 12.9756,
      "longitude": 77.6066,
      "address": "MG Road, Bengaluru",
      "category": "work",
      "created_at": "2026-10-06T17:31:37.000Z"
    }
  ],
  "meta": { "count": 1 }
}
```

### `POST /api/saved`
Bookmarks a new place for the authenticated user.

- **Auth Required:** Yes (`Bearer <token>`)
- **Request Body:**
```json
{
  "name": "Koramangala 5th Block",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "address": "Near Forum Mall",
  "category": "home"
}
```
- **Success Status:** `201 Created`

### `GET /api/saved/:id`
Retrieves a specific saved place by ID (enforces user ownership).

- **Auth Required:** Yes (`Bearer <token>`)
- **Success Status:** `200 OK`

### `PUT /api/saved/:id`
Updates fields of an existing saved place.

- **Auth Required:** Yes (`Bearer <token>`)
- **Request Body:**
```json
{
  "name": "Koramangala Residency Hub",
  "latitude": 12.9352,
  "longitude": 77.6245,
  "category": "favorite"
}
```
- **Success Status:** `200 OK`

### `DELETE /api/saved/:id`
Deletes a saved place bookmark.

- **Auth Required:** Yes (`Bearer <token>`)
- **Success Status:** `200 OK`

---

## 4. Route History APIs

### `GET /api/history?limit=20`
Lists past route requests and trip logs for the authenticated user.

- **Auth Required:** Yes (`Bearer <token>`)
- **Success Status:** `200 OK`

### `POST /api/history`
Manually logs a completed or queried route into the user's trip history.

- **Auth Required:** Yes (`Bearer <token>`)
- **Request Body:**
```json
{
  "origin_lat": 12.9756,
  "origin_lng": 77.6066,
  "origin_name": "MG Road",
  "dest_lat": 12.9352,
  "dest_lng": 77.6245,
  "dest_name": "Koramangala",
  "transport_mode": "car",
  "total_distance_meters": 6850,
  "total_duration_seconds": 1120,
  "traditional_duration_seconds": 1480,
  "time_saved_seconds": 360
}
```
- **Success Status:** `201 Created`

---

## 5. Incident APIs

### `GET /api/incidents?status=active`
Lists active road hazards, accidents, and simulated bottlenecks.

- **Auth Required:** No
- **Success Status:** `200 OK`

### `POST /api/incidents`
Reports or simulates a road incident on a specific chunk.

- **Auth Required:** Optional (attaches `reported_by` if token present)
- **Request Body:**
```json
{
  "chunkId": "CHUNK_104",
  "type": "accident",
  "description": "Multi-vehicle collision on right lane",
  "latitude": 12.9550,
  "longitude": 77.6050
}
```
- **Success Status:** `201 Created`

### `PUT /api/incidents/:id/status`
Updates incident status (e.g. mark `cleared`).

- **Auth Required:** Yes (`Bearer <token>`)
- **Request Body:**
```json
{
  "status": "cleared"
}
```
- **Success Status:** `200 OK`

---

## 6. Dynamic Directions Integration API

### `POST /api/directions/dynamic`
The central Member 3 integration pipeline endpoint connecting ML ChunkFlow predictions, dynamic cost graph routing, and incident rerouting.

- **Auth Required:** Optional (if token is provided, route is automatically recorded into user's `route_history`).
- **Request Body:**
```json
{
  "origin": {
    "lat": 12.9716,
    "lng": 77.5946
  },
  "destination": {
    "lat": 12.9352,
    "lng": 77.6245
  },
  "mode": "car",
  "simulatedIncident": {
    "chunkId": "CHUNK_104",
    "type": "accident"
  }
}
```

- **Supported Modes:** `car`, `motorcycle`, `bike`, `pedestrian`
- **Supported Incident Types:** `accident`, `roadblock`, `construction`, `flooding`, `heavy_traffic`, `other`

- **Success Status:** `200 OK`
- **Response Format (Exact Member 4 Contract):**
```json
{
  "summary": {
    "totalDistanceMeters": 6850,
    "totalDurationSeconds": 1120,
    "traditionalDurationSeconds": 1480,
    "timeSavedSeconds": 360,
    "mode": "car"
  },
  "chunks": [
    {
      "chunkId": "CHUNK_101",
      "roadName": "Hosur Main Road",
      "lengthMeters": 350,
      "predictedSpeedKmh": 42.5,
      "congestionLevel": "low",
      "color": "#10b981",
      "coordinates": [
        [12.971600, 77.594600],
        [12.968000, 77.596000]
      ]
    }
  ],
  "steps": [
    {
      "instruction": "Head south on Hosur Main Road towards 100 Feet Road Corridor",
      "distance": "350m"
    }
  ]
}
```

---

## 7. External Geospatial & POI Services

### `GET /api/services/geocode?q=MG+Road+Bengaluru&limit=5`
Forward geocoding via OpenStreetMap Nominatim.

### `GET /api/services/reverse?lat=12.9756&lng=77.6066`
Reverse geocoding (coordinates to structured address).

### `GET /api/services/poi?lat=12.9756&lng=77.6066&radius=1000&category=fuel|hospital`
Nearby POI discovery via Overpass API.

### `POST /api/services/fallback-route`
Macro-routing calculation via OSRM / Valhalla.

---

## 8. Error Responses & Status Codes

All error responses adhere to a consistent structure:
```json
{
  "success": false,
  "error": {
    "message": "Invalid origin coordinates: lat=999, lng=77.5946",
    "statusCode": 400
  }
}
```

| HTTP Status | Name | Meaning |
|---|---|---|
| `200` | OK | Request succeeded |
| `201` | Created | Resource successfully created |
| `400` | Bad Request | Validation failed or malformed JSON |
| `401` | Unauthorized | Missing or expired JWT Bearer token |
| `403` | Forbidden | Authenticated user lacks permission for target resource |
| `404` | Not Found | Target endpoint or resource ID does not exist |
| `409` | Conflict | Duplicate unique key (e.g. email or username already registered) |
| `500` | Internal Server Error | Unexpected server error (stack trace concealed in production) |
| `502` | Bad Gateway | Upstream geospatial or navigation provider failure |
