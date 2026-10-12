# TerraNav AI — Member 3 Complete Backend & Learning Guide

**Role:** Backend Integration, Microservices & Data Layer Architect  
**Author:** TerraNav AI Engineering  
**System:** Node.js, Express.js, MySQL (XAMPP), JWT, ML & Routing Adapters

---

## 1. What Member 3 Does
Member 3 builds and owns the **central integration bridge** of the TerraNav AI ecosystem. While Member 1 develops ML traffic prediction models, Member 2 builds the graph routing algorithms, and Member 4 creates the final React map frontend, **Member 3 connects all these components into a reliable, secure, high-performance REST API gateway backed by MySQL**.

---

## 2. Complete System Architecture

```text
React / Leaflet Client (Port 5000 / 3000)
             │
             │ HTTP / JSON (Bearer JWT)
             ▼
Express.js API Gateway (Port 5000)
 ├── Security & Middleware: CORS, Body Parser, Rate Limiter, Auth Middleware
 ├── REST Route Handlers:
 │    ├── /api/health       (System & DB status)
 │    ├── /api/auth/*       (Register, Login, Me)
 │    ├── /api/saved/*      (User Saved Places CRUD)
 │    ├── /api/history/*    (User Trip & Route History)
 │    ├── /api/incidents/*  (Road Hazard & Incident Logging)
 │    ├── /api/directions/* (Dynamic Multi-cost Directions)
 │    └── /api/services/*   (Nominatim Geocoding, Overpass POI, OSRM/Valhalla)
 ├── Adapters & Services:
 │    ├── db.js             (mysql2/promise Pool + In-Memory Fallback)
 │    ├── mlAdapter.js      (ChunkFlow Traffic Speed & Density Predictor)
 │    ├── routingAdapter.js (Dynamic Cost Optimizer & Maneuver Generator)
 │    ├── geocoding.js      (Nominatim Forward & Reverse Geocoding)
 │    ├── poi.js            (Overpass POI discovery)
 │    └── navigation.js     (Valhalla / OSRM macro-routing fallback)
 └── Storage:
      └── MySQL (XAMPP localhost:3306 - terranav_db)
```

---

## 3. Folder & File Structure
```text
terraNav/
├── api/
│   ├── _lib/
│   │   ├── db.js             # MySQL connection pool + fallback
│   │   ├── auth.js           # JWT verification & middleware
│   │   ├── validation.js     # Coordinate & payload validators
│   │   ├── errors.js         # Custom AppError classes & response envelopes
│   │   ├── logging.js        # Structured logger
│   │   ├── navigation.js     # Valhalla & OSRM adapters
│   │   ├── geocoding.js      # Nominatim geocoder
│   │   └── poi.js            # Overpass POI extractor
│   ├── auth/                 # Controller & Service for accounts
│   ├── saved/                # Controller & Service for saved places
│   ├── history/              # Controller & Service for trip logs
│   ├── incidents/            # Controller & Service for road hazards
│   ├── directions/           # Dynamic directions pipeline & adapters
│   ├── places/               # External proxy controllers
│   ├── index.js              # Master router
│   └── server.js             # Express startup entry point
├── database/
│   └── schema.sql            # Relational DDL tables & indexes
├── docs/                     # Guides and API references
├── public/                   # Frontend testing harness
├── postman/                  # Postman collection v2.1
├── tests/                    # 48-point automated test suite
├── package.json
└── context.md
```

---

## 4. Request Lifecycle
1. **Client Request**: Browser/Postman sends HTTP request with JSON body or headers.
2. **Global Middleware**: CORS evaluates origin; `express.json()` parses payload; logger timestamps request.
3. **Route Matching**: `api/index.js` routes path to specific sub-router.
4. **Auth Guard**: `requireAuth` extracts `Authorization: Bearer <token>`, verifies JWT signature, attaches `req.user`.
5. **Validation**: Controller calls validation schemas in `_lib/validation.js`.
6. **Service Execution**: Business logic runs queries via MySQL pool or calls ML/routing adapters.
7. **Response Envelope**: Standardized JSON sent via `sendSuccess()` or caught by `errorHandler`.

---

## 5. Node.js & Express.js Core Concepts
- **Non-blocking Event Loop**: Handles high concurrency I/O operations without thread starvation.
- **Middleware Chain**: Functions with `(req, res, next)` signature executed sequentially.
- **RESTful Endpoints**: Clean noun-based URIs mapped to standard HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`).

---

## 6. MySQL Database & Schema Design
The database `terranav_db` contains four relational tables:
1. `users`: Identity and bcrypt password hashes.
2. `saved_places`: User bookmarks with foreign key to `users.id` (ON DELETE CASCADE).
3. `route_history`: Past route distance, dynamic ETA, and traditional baseline savings.
4. `incidents`: Active and cleared road hazards indexed by `chunk_id` and `status`.

---

## 7. Connection Pooling & Performance
- Uses `mysql2/promise` with `connectionLimit: 10`.
- **Why Pooling?** Creating TCP handshakes for each request introduces 20–50ms latency. Reusable connections in a pool serve queries instantly and limit database load under heavy traffic.
- **Dual-Mode Adapter**: If MySQL in XAMPP is offline, `_lib/db.js` gracefully switches to an in-memory SQL repository so development and tests never crash.

---

## 8. Database Indexing
- `idx_users_email` & `idx_users_username`: $O(1)$ fast lookups during authentication.
- `idx_saved_places_user` & `idx_route_history_user`: Optimizes user data retrieval by foreign key.
- `idx_incidents_chunk` & `idx_incidents_status`: Enables sub-millisecond incident retrieval during dynamic routing.

---

## 9. JWT Authentication & Password Hashing
- **Hashing with bcryptjs**: Salt rounds = 10. Passwords are never stored in plaintext.
- **JWT Signing**: Payload `{ id, username, email }` signed with `JWT_SECRET` and expiration (`7d`).
- **Stateless Verification**: Protected endpoints verify signature mathematically without querying the database for every single API request.

---

## 10. Dynamic Directions Architecture (`POST /api/directions/dynamic`)
The core Member 3 integration pipeline follows:
1. **Input Normalization**: Validates origin/destination coordinates and transport mode (`car`, `motorcycle`, `pedestrian`).
2. **Chunk Decomposition**: Splits route corridor into 200–500m segments (`CHUNK_101`, `CHUNK_102`, etc.).
3. **ML Prediction**: `mlAdapter.js` computes predicted speed (km/h), traffic density (%), and congestion color (`#10b981`, `#f59e0b`, `#ef4444`, `#7f1d1d`).
4. **Incident Penalty**: Injects active or simulated accident/roadblock delays.
5. **Cost Optimization**:
   $$\text{Cost}_{\text{chunk}} = \frac{\text{Length}}{\text{Speed} \times \text{ModeFactor}} + \text{Delay}_{\text{queue}} + \text{Delay}_{\text{signal}} + \text{Delay}_{\text{incident}}$$
6. **Maneuver Generation**: Formats turn-by-turn guidance steps.
7. **Frontend Contract**: Returns exact `{ summary, chunks, steps }` format.

---

## 11. External Services Integration
- **Nominatim**: OpenStreetMap forward and reverse geocoding with user-agent headers and caching.
- **Overpass API**: POI search for gas stations, parking, hospitals, and amenities.
- **OSRM & Valhalla**: External macro-routing engines used for fallback navigation.

---

## 12. Viva / Exam Questions & Concise Answers

1. **What is Member 3's primary responsibility?**
   *Answer:* Designing the backend REST API gateway, MySQL database layer, JWT authentication, and integrating the ML prediction and routing algorithms into a unified endpoint.

2. **Why use JWT instead of session cookies?**
   *Answer:* JWT is stateless, scalable across distributed microservices, and does not require server-side session memory storage.

3. **How is SQL Injection prevented?**
   *Answer:* By using parameterized SQL queries (`pool.execute(sql, [params])`) where input data is sent separately from SQL syntax.

4. **What is connection pooling?**
   *Answer:* A cache of pre-established database connections reused across incoming requests, reducing connection overhead and latency.

5. **How does dynamic routing calculate chunk travel time?**
   *Answer:* Length divided by ML predicted speed plus queue delay, signal delay, and incident penalties.

6. **What happens if an external service fails?**
   *Answer:* The adapter catches the timeout or error, logs a warning, and returns cached or baseline fallback data without crashing the API.

---

## 13. Step-by-Step Demo Procedure

1. **Start XAMPP MySQL** (or run in fallback mode).
2. **Start Backend Server**:
   ```bash
   npm.cmd start
   ```
3. **Open Testing UI**: Navigate to `http://localhost:5000/`.
4. **Register / Login**: Sign in as `demo@terranav.ai` (Password: `Password123!`).
5. **Compute Dynamic Route**: Click "Calculate Dynamic Route" to see color-coded ML congestion chunks and time savings.
6. **Simulate Accident**: Enable "Simulated Incident" on `CHUNK_104`, re-calculate, and observe increased delay and adjusted path.
7. **Save Place & View History**: Bookmark location and view logged trips.
8. **Run Automated Test Suite**:
   ```bash
   npm.cmd test
   ```
