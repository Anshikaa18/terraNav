# TerraNav AI — Member 3 Backend Requirements

## Document Purpose

This document is the complete implementation requirement for **Member 3: Backend Integration, Microservices & Data Layer Architect** of the TerraNav AI project.

It is intended to be used as the **single source of truth for the AI coding agent** and as a learning/reference document for the human developer.

The backend work will be developed, tested, debugged, and demonstrated locally using:

- **Node.js**
- **Express.js** where compatible with the existing project
- **MySQL through XAMPP**
- **mysql2/promise**
- **JWT authentication**
- **Axios** for external HTTP services
- **Postman** for API testing
- Existing ML and dynamic-routing modules supplied by Members 1 and 2
- Existing React/Leaflet frontend supplied by Member 4

The implementation must preserve the project's existing architecture and interfaces. The agent must inspect the repository before creating or replacing code.

---

# 1. Project Context

TerraNav AI combines:

1. **TerraNav** — interactive map/navigation frontend.
2. **ChunkFlow** — AI-based chunk-level traffic prediction and dynamic routing engine.

Roads are represented using approximately **200–500 meter chunks**. ML predicts chunk-level traffic density and average speed. The routing engine uses those predictions together with queue, signal, and incident delays to calculate optimized routes.

Member 3 owns the backend layer connecting the frontend, ML model, routing engine, database, and external services.

## Overall System Flow

```text
React + Leaflet Frontend
        |
        | HTTP/JSON
        v
Member 3 Backend API
        |
        +--------------------+
        |                    |
        v                    v
   MySQL / XAMPP       ML Prediction Service
        |                    |
        |                    v
        |             Dynamic Routing Engine
        |                    |
        +----------+---------+
                   |
                   v
          External Services
       Valhalla / OSRM
       Nominatim
       Overpass
                   |
                   v
            Backend Response
                   |
                   v
          React Map / Dashboard
```

---

# 2. Member 3 Ownership

Member 3 is responsible for:

- REST API gateway
- Integrated routing endpoint
- ML/routing service integration
- Route response formatting
- MySQL database architecture
- JWT authentication
- User accounts
- Saved places
- Route history/trip logs
- Incident logging
- Valhalla/OSRM navigation fallback
- Nominatim geocoding
- Overpass POI discovery
- Shared backend utilities
- Request validation
- Error handling
- Database connection pooling
- Database indexing
- Appropriate caching/rate limiting
- Integration reliability
- Integration latency considerations
- API testing
- Backend debugging
- Postman testing
- Backend documentation

The project specification identifies the main backend locations as:

```text
minor-project/api/
    directions.js
    auth/
    places/
    saved/
    history/

minor-project/database/
    schema.sql

minor-project/api/_lib/
    shared backend utilities
```

The exact repository structure must be inspected before implementation. If the existing project uses a different but reasonable structure, adapt to it instead of unnecessarily restructuring the project.

---

# 3. Technology Requirements

## Backend

Preferred technology:

- Node.js
- Express.js
- JavaScript

If the repository already uses another compatible backend architecture, preserve it unless there is a strong reason to change it.

## Database

- MySQL
- XAMPP for local MySQL and phpMyAdmin management
- mysql2/promise
- Connection pooling

## Authentication

- JWT
- Secure password hashing
- Bearer-token authentication

## HTTP / External APIs

- Axios or existing HTTP client
- Valhalla
- OSRM
- Nominatim
- Overpass

## Testing

- Postman
- Automated tests where practical
- Manual endpoint verification

---

# 4. Development Environment

## XAMPP

XAMPP will be used for the local MySQL database.

Required local services:

```text
XAMPP
 └── MySQL
```

Apache is not required unless another project component explicitly needs it.

phpMyAdmin may be used to inspect:

- databases
- tables
- indexes
- rows
- relationships
- SQL queries

The agent must document:

1. How to start MySQL in XAMPP.
2. How to create the TerraNav database.
3. How to execute `schema.sql`.
4. How to verify tables in phpMyAdmin.
5. How to configure database credentials.
6. How to troubleshoot MySQL connection errors.

---

# 5. Repository Audit Requirement

Before modifying backend code, the agent MUST inspect:

- repository structure
- package.json
- existing server entry point
- existing API routes
- existing database code
- environment files
- frontend API calls
- ML module
- routing module
- existing documentation
- existing tests
- existing configuration

The agent must determine:

- what already exists
- what is incomplete
- what is mocked
- what is real
- what belongs to another team member
- what Member 3 must implement
- what interfaces already exist

The agent must not blindly recreate existing modules.

---

# 6. Required Backend Architecture

Use a clean separation between:

```text
Route
  ↓
Controller / Handler
  ↓
Service
  ↓
Database / External API / ML / Routing Adapter
  ↓
Response
```

Recommended conceptual structure:

```text
api/
├── auth/
├── directions/
├── saved/
├── history/
├── incidents/
├── places/
└── _lib/
    ├── db
    ├── auth
    ├── validation
    ├── errors
    ├── logging
    ├── navigation
    ├── geocoding
    └── poi

database/
└── schema.sql

docs/
├── MEMBER3_BACKEND_GUIDE.md
├── API_REFERENCE.md
└── POSTMAN_GUIDE.md
```

The exact implementation may differ if the repository already has a suitable structure.

---

# 7. Environment Configuration

Secrets and machine-specific configuration must not be hard-coded.

The backend should use environment variables for items such as:

```text
PORT
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
JWT_SECRET
JWT_EXPIRES_IN

VALHALLA_BASE_URL
OSRM_BASE_URL
NOMINATIM_BASE_URL
OVERPASS_BASE_URL
```

The exact names may be adapted to the repository.

The repository must not commit real secrets.

Provide a safe `.env.example`.

---

# 8. Backend Foundation

Implement or verify:

- server startup
- routing
- JSON parsing
- CORS
- environment configuration
- centralized error handling
- request validation
- reusable response utilities
- logging
- health check
- database connection module
- graceful failure handling

Required health endpoint:

```http
GET /api/health
```

Expected behavior:

- returns HTTP 200 when backend is healthy
- provides a simple machine-readable response
- does not expose secrets

---

# 9. Database Requirements

The database must use MySQL through XAMPP.

## Required Core Tables

At minimum, design relational tables for:

```text
users
saved_places
route_history
incidents
```

The exact columns should be based on actual application requirements and existing code.

## Users

Must support:

- unique user identity
- email/username as appropriate
- password hash
- timestamps
- account metadata if required

Passwords must never be stored in plaintext.

## Saved Places

Must support:

- authenticated user
- place name
- latitude
- longitude
- optional address/metadata
- timestamps

## Route History

Must support useful trip information such as:

- authenticated user
- origin
- destination
- transport mode
- distance
- duration
- timestamp
- route metadata where appropriate

Avoid unnecessarily storing enormous duplicate route payloads.

## Incidents

Must support:

- incident/chunk ID
- incident type
- location if required
- status if required
- timestamps
- source/user information if required

---

# 10. Database Engineering Requirements

Use:

- primary keys
- foreign keys
- unique constraints
- indexes
- appropriate data types
- timestamps
- parameterized SQL

Frequently queried fields should be indexed where appropriate.

User-specific queries must use indexed user identifiers where practical.

The backend must use a MySQL connection pool rather than creating a new database connection for every request.

The agent must document:

- why pooling is used
- why indexes are used
- how foreign keys work
- how parameterized SQL prevents SQL injection
- how database errors are handled

---

# 11. JWT Authentication

Implement:

```http
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

## Register

Requirements:

- validate input
- check duplicate identity
- hash password
- create user
- never return password hash unnecessarily

## Login

Requirements:

- validate credentials
- compare password securely
- create JWT
- return token and safe user information

## Current User

```http
GET /api/auth/me
```

Requires:

```http
Authorization: Bearer <JWT>
```

The backend must verify the JWT before returning authenticated user information.

Protected requests should expose the authenticated user through a consistent property such as:

```text
req.user.id
```

---

# 12. Authentication Concepts to Document

The documentation must explain:

- authentication
- authorization
- hashing
- encryption vs hashing
- JWT
- JWT payload
- JWT signature
- bearer token
- Authorization header
- middleware
- access control

Simple authentication flow:

```text
Register
   ↓
Hash Password
   ↓
Store User
   ↓
Login
   ↓
Verify Password
   ↓
Generate JWT
   ↓
Client Sends JWT
   ↓
Auth Middleware
   ↓
Verify JWT
   ↓
Identify User
   ↓
Protected Endpoint
```

---

# 13. Saved Places API

Implement protected CRUD APIs.

Suggested endpoints:

```http
POST   /api/saved
GET    /api/saved
GET    /api/saved/:id
PUT    /api/saved/:id
DELETE /api/saved/:id
```

Requirements:

- JWT required
- validate coordinates
- validate resource IDs
- user can only access their own saved places
- parameterized SQL
- appropriate HTTP status codes
- useful error messages

---

# 14. Route History API

Suggested endpoints:

```http
POST /api/history
GET /api/history
GET /api/history/:id
```

Requirements:

- JWT required where user-specific
- store route/trip information
- associate history with user
- validate input
- prevent cross-user access
- support dynamic route history

---

# 15. Incident API

Suggested endpoints:

```http
POST   /api/incidents
GET    /api/incidents
GET    /api/incidents/:id
PUT    /api/incidents/:id
DELETE /api/incidents/:id
```

Requirements:

- validate incident type
- validate chunk ID where applicable
- validate coordinates where applicable
- store incident state
- support simulated incident workflow
- protect user-specific operations where appropriate

---

# 16. Central Dynamic Directions API

This is the main Member 3 integration endpoint.

Required endpoint:

```http
POST /api/directions/dynamic
```

The endpoint connects:

```text
Frontend
   ↓
Backend
   ↓
ML prediction
   ↓
Dynamic routing
   ↓
Incident handling
   ↓
Route formatting
   ↓
Frontend
```

---

# 17. Dynamic Directions Request Contract

Required request shape:

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

`simulatedIncident` is optional.

The backend must validate:

- origin exists
- destination exists
- latitude range
- longitude range
- mode
- incident structure
- incident type

Do not silently accept malformed data.

---

# 18. Dynamic Directions Processing

The backend should perform the following logical sequence:

```text
1. Receive request
2. Validate request
3. Normalize coordinates and mode
4. Obtain road-network/routing information
5. Obtain ML traffic predictions
6. Pass predictions into routing engine
7. Apply incident information if supplied
8. Calculate optimized route
9. Obtain/calculate traditional baseline duration
10. Format route chunks
11. Format navigation steps
12. Calculate route summary
13. Persist history when appropriate
14. Return frontend-compatible JSON
```

The actual sequence may be adapted to the real interfaces of Members 1 and 2.

---

# 19. Dynamic Directions Response Contract

The backend should return a structure compatible with:

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
      "roadName": "Hosur Road",
      "lengthMeters": 450,
      "predictedSpeedKmh": 42.5,
      "congestionLevel": "low",
      "color": "#10b981",
      "coordinates": [
        [12.9716, 77.5946],
        [12.9680, 77.5960]
      ]
    }
  ],
  "steps": [
    {
      "instruction": "Head south on Hosur Road",
      "distance": "450m"
    }
  ]
}
```

The example values are illustrative only.

The backend must use real ML/routing output where available.

Do not hard-code example route values into production logic.

---

# 20. Member 1 ML Integration

Member 3 must inspect the actual ML module before implementing integration.

Determine:

- inference entry point
- input features
- feature preparation requirements
- model loading mechanism
- prediction output
- speed output
- density output
- whether inference is local or exposed through a service
- expected error behavior

Create an adapter/service layer if required.

Do not rewrite the ML model.

Do not invent an API contract if Member 1 already provides one.

If the ML module is temporarily unavailable:

- isolate a mock adapter
- clearly label it as mock
- document the expected real interface
- never pretend mock data is real ML output

---

# 21. Member 2 Dynamic Routing Integration

Member 3 must inspect the actual routing module.

Determine:

- graph input
- route function
- edge-cost function
- transport-mode handling
- incident handling
- route output
- geometry format
- maneuver output

Create an adapter/service around the routing engine if required.

Do not rewrite the core Dijkstra/A* implementation unless explicitly necessary.

The project's dynamic cost concept is:

```text
Cost_chunk =
    Length / Predicted_Speed
    + Delay_queue
    + Delay_signal
    + Delay_incident
```

Member 3's responsibility is primarily to connect the services and expose the result through the API.

---

# 22. Transport Modes

The backend must support modes provided by the routing engine.

The project specifies behavior for:

- car
- motorcycle/bike
- pedestrian

Do not invent unsupported modes.

The backend must validate the mode before passing it to routing.

---

# 23. Incident Integration

The backend must support simulated incidents through:

```json
"simulatedIncident": {
  "chunkId": "CHUNK_104",
  "type": "accident"
}
```

The backend must pass valid incident information into the routing layer.

Expected logical flow:

```text
Incident supplied
      ↓
Validate incident
      ↓
Identify affected chunk
      ↓
Routing cost updated
      ↓
Route recalculated
      ↓
New route returned
```

If the routing engine handles incident simulation itself, Member 3 should pass the data through the established interface rather than duplicating routing logic.

---

# 24. External Navigation Services

Member 3 must provide reusable integrations/adapters for:

- Valhalla
- OSRM

These services are intended as navigation/fallback engines, particularly for macro-routing outside simulated high-density chunk corridors.

The backend must not tightly couple controllers to one provider.

Prefer an abstraction such as:

```text
navigationService
    ├── Valhalla adapter
    └── OSRM adapter
```

External API failures must be handled safely.

---

# 25. Nominatim Geocoding

Provide a reusable Nominatim integration for geocoding requirements.

The integration must:

- use configurable base URL
- validate input
- handle provider errors
- handle timeouts
- normalize useful response data
- avoid leaking raw provider failures directly to clients

Respect external service usage requirements.

---

# 26. Overpass POI Discovery

Provide a reusable Overpass integration for point-of-interest discovery.

The integration must:

- isolate provider-specific logic
- validate request parameters
- handle provider failure
- normalize useful response data
- avoid putting raw Overpass calls inside controllers

---

# 27. Error Handling

The backend must handle:

- invalid request
- missing fields
- invalid coordinates
- invalid mode
- invalid JWT
- missing JWT
- unauthorized resource
- missing database record
- database failure
- routing failure
- ML failure
- external API failure
- provider timeout
- malformed external response
- no route found
- unexpected server error

Do not expose internal stack traces or secrets to normal API clients.

Use appropriate HTTP status codes.

Common statuses to document:

```text
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity, if used
500 Internal Server Error
502 Bad Gateway, if appropriate for upstream failures
503 Service Unavailable, if appropriate
```

---

# 28. API Validation

Every externally supplied value must be validated.

Validate:

- request body
- route parameters
- query parameters
- coordinates
- IDs
- mode
- incident type
- authentication headers

Use existing project validation libraries if present.

Do not add a large dependency merely for simple validation if the project does not need it.

---

# 29. Security Requirements

The backend must:

- hash passwords
- never store plaintext passwords
- protect JWT secret
- never commit secrets
- use parameterized SQL
- validate user input
- enforce ownership checks
- prevent unauthorized resource access
- avoid exposing internal stack traces
- configure CORS deliberately
- avoid unsafe debug output

---

# 30. CORS

Configure CORS so the React frontend can communicate with the backend during development.

Do not use unrestricted CORS in a production-oriented configuration unless explicitly justified.

Document:

- what CORS is
- why the browser blocks cross-origin requests
- how the frontend origin is configured

---

# 31. Database Connection Pooling

Use a reusable MySQL pool.

Conceptually:

```text
API Request
    ↓
Database Service
    ↓
Connection Pool
    ↓
MySQL/XAMPP
```

Do not create a new database connection for every query unless the project's architecture explicitly requires it.

Document:

- why pooling improves reliability/performance
- how pool errors are handled
- how database credentials are configured

---

# 32. Database Indexing

Create indexes for fields frequently used in:

- user lookup
- authentication
- saved-place retrieval
- route-history retrieval
- incident lookup
- foreign-key relationships

Do not blindly index every column.

Document the reason for each important index.

---

# 33. Caching

Consider lightweight caching for appropriate external/service responses where useful.

Potential candidates:

- repeated geocoding
- repeated POI queries
- stable navigation data

Do not introduce Redis or another infrastructure component unless it is actually needed.

Avoid adding architecture merely for appearance.

---

# 34. Rate Limiting

Consider rate limiting for:

- authentication endpoints
- public/external-service proxy endpoints
- expensive dynamic directions requests

Use an approach compatible with the current project.

Document:

- what rate limiting protects
- what endpoints are limited
- what happens when the limit is exceeded

---

# 35. Logging

Logs should help diagnose:

- server startup
- request failures
- database errors
- external API failures
- routing failures
- ML integration failures

Do not log:

- passwords
- JWT secrets
- unnecessary personal data
- authentication secrets

---

# 36. Postman Testing

Postman is the primary manual API testing tool.

Create a collection organized as:

```text
01 Health
02 Authentication
03 Saved Places
04 Route History
05 Incidents
06 Dynamic Directions
07 External Services
```

Use environment variables:

```text
baseUrl
jwtToken
```

---

# 37. Required Postman Test Sequence

Test in this order:

```text
1. Health check
2. Register
3. Login
4. Store JWT
5. Get current user
6. Create saved place
7. List saved places
8. Update saved place
9. Delete saved place
10. Create route history
11. Get route history
12. Create incident
13. Get incidents
14. Dynamic route
15. Dynamic route with simulated incident
```

---

# 38. Negative Postman Tests

Test:

- missing required fields
- invalid coordinates
- invalid JWT
- missing JWT
- duplicate registration
- wrong password
- nonexistent resource
- unauthorized resource access
- invalid mode
- malformed JSON
- database failure where practical
- external service failure where practical

The documentation must explain what each failure demonstrates.

---

# 39. Postman Beginner Tutorial

The documentation must explain:

## Collection

A group of related API requests.

## Request

One HTTP call to an endpoint.

## Method

Examples:

```text
GET
POST
PUT
DELETE
```

## URL

The API endpoint being tested.

## Headers

Metadata sent with the request.

Example:

```text
Authorization: Bearer <JWT>
Content-Type: application/json
```

## Body

Data sent to the backend.

Example:

```json
{
  "email": "user@example.com",
  "password": "example-password"
}
```

## Response

The data returned by the backend.

## Status Code

Indicates success/failure.

## Environment Variable

Reusable values such as:

```text
{{baseUrl}}
{{jwtToken}}
```

The agent must provide exact Postman steps for the project.

---

# 40. API Documentation

Create or update:

```text
docs/API_REFERENCE.md
```

For every endpoint document:

```text
METHOD
URL
AUTH REQUIRED
HEADERS
PARAMETERS
REQUEST BODY
SUCCESS STATUS
SUCCESS RESPONSE
ERROR RESPONSES
DATABASE EFFECT
EXTERNAL SERVICE EFFECT
```

---

# 41. Backend Learning Documentation

Create/update:

```text
docs/MEMBER3_BACKEND_GUIDE.md
```

This file is not merely technical documentation. It is the developer's learning guide.

It must explain:

1. What Member 3 does
2. Complete architecture
3. Folder structure
4. Request lifecycle
5. Node.js/Express basics
6. REST APIs
7. HTTP methods
8. HTTP status codes
9. Middleware
10. Environment variables
11. MySQL
12. XAMPP
13. phpMyAdmin
14. Database tables
15. Relationships
16. Indexing
17. Connection pooling
18. JWT
19. Authentication
20. Authorization
21. Saved places
22. Route history
23. Incidents
24. Dynamic directions
25. ML integration
26. Routing integration
27. Valhalla
28. OSRM
29. Nominatim
30. Overpass
31. Validation
32. Error handling
33. Caching
34. Rate limiting
35. Postman
36. Debugging
37. Frontend/backend contract
38. ML/backend contract
39. routing/backend contract
40. End-to-end flow
41. Testing results
42. Known limitations
43. Viva questions
44. Final demo procedure

After every major implementation phase, update this document.

---

# 42. Debugging Requirements

Create a troubleshooting section.

At minimum cover:

## Server Does Not Start

Check:

- Node.js installation
- package installation
- environment variables
- syntax errors
- port availability

## Port Already in Use

Explain how to identify and resolve the process conflict.

## MySQL Connection Failure

Check:

- XAMPP MySQL status
- host
- port
- username
- password
- database name
- firewall/configuration

## JWT Invalid

Check:

- token format
- Bearer prefix
- expiration
- JWT secret
- token corruption

## CORS Error

Check:

- frontend origin
- backend CORS configuration
- browser request

## 404

Check:

- method
- URL
- route registration
- server prefix

## 400

Check:

- request JSON
- required fields
- validation

## 401

Check:

- token
- Authorization header
- authentication middleware

## 403

Check:

- ownership/authorization

## 500

Check:

- backend logs
- database
- unexpected exception

## External API Failure

Check:

- URL
- timeout
- network
- provider status
- malformed response

---

# 43. Testing Strategy

Testing should happen at several levels.

## Level 1: Health

Verify server startup.

## Level 2: Database

Verify:

- connection
- schema
- CRUD
- constraints
- indexes

## Level 3: Authentication

Verify:

- registration
- login
- JWT
- protected endpoints
- invalid credentials

## Level 4: API CRUD

Verify:

- saved places
- route history
- incidents

## Level 5: Dynamic Directions

Verify:

- valid route
- invalid request
- transport modes
- incident simulation

## Level 6: Integration

Verify:

```text
Backend
 ↔ ML
 ↔ Routing
 ↔ External services
 ↔ MySQL
```

## Level 7: Frontend Contract

Verify that Member 4 can consume the response without manual transformation that should have been handled by the backend.

---

# 44. Mock vs Real Integration

The agent must clearly distinguish:

```text
REAL
MOCK
NOT AVAILABLE
```

Examples:

```text
ML integration: REAL
Routing integration: REAL
OSRM: REAL
Valhalla: NOT AVAILABLE
```

or:

```text
ML integration: MOCK
```

if the actual model is not available.

Never claim a mock service is real.

Never silently replace a failed real service with fake output.

---

# 45. Final End-to-End Demonstration

The final demonstration should follow:

```text
1. Start XAMPP
2. Start MySQL
3. Verify database in phpMyAdmin
4. Start backend
5. Verify /api/health
6. Start ML service/module if required
7. Start routing service/module if required
8. Start frontend
9. Register/login
10. Select origin
11. Select destination
12. Select transport mode
13. Request dynamic route
14. Display route
15. Display congestion information
16. Simulate accident
17. Recalculate route
18. Show changed route
19. Save a place
20. View route history
21. View incident
```

---

# 46. Viva Preparation

The developer must be able to explain:

1. Why REST API?
2. Why Node.js?
3. Why Express?
4. Why MySQL?
5. Why XAMPP?
6. Why JWT?
7. Authentication vs authorization?
8. Why password hashing?
9. What is middleware?
10. What is CORS?
11. What is connection pooling?
12. Why database indexes?
13. What is SQL injection?
14. How is SQL injection prevented?
15. What is an API gateway?
16. How does frontend communicate with backend?
17. How does backend communicate with ML?
18. How does backend communicate with routing?
19. How does incident information reach routing?
20. How does the backend return chunk-level traffic?
21. Why Valhalla/OSRM?
22. Why Nominatim?
23. Why Overpass?
24. What happens when an external API fails?
25. What is rate limiting?
26. What is caching?
27. What is a 400?
28. What is a 401?
29. What is a 403?
30. What is a 404?
31. What is a 500?
32. Why use service/adapters?
33. How does route history work?
34. How are users prevented from seeing other users' data?
35. How does dynamic rerouting work?

Answers must be short enough to speak naturally during a viva but technically correct.

---

# 47. Final Quality Audit

Before declaring Member 3 complete, audit:

- [ ] Backend starts
- [ ] Environment configuration works
- [ ] XAMPP MySQL connection works
- [ ] Database schema executes
- [ ] Tables exist
- [ ] Indexes exist
- [ ] Connection pool works
- [ ] Health endpoint works
- [ ] Registration works
- [ ] Login works
- [ ] JWT works
- [ ] Protected endpoints work
- [ ] Saved places work
- [ ] Route history works
- [ ] Incidents work
- [ ] Dynamic directions endpoint works
- [ ] Request validation works
- [ ] ML adapter works or is clearly documented as mock/unavailable
- [ ] Routing adapter works or is clearly documented as mock/unavailable
- [ ] Incident integration works
- [ ] Route response matches frontend contract
- [ ] Navigation fallback is implemented or documented
- [ ] Nominatim integration is implemented or documented
- [ ] Overpass integration is implemented or documented
- [ ] Error handling works
- [ ] CORS works
- [ ] Secrets are not committed
- [ ] SQL is parameterized
- [ ] Postman collection works
- [ ] Documentation is updated
- [ ] Known limitations are documented
- [ ] Final demo works

---

# 48. Agent Rules

The AI coding agent MUST follow these rules:

1. Inspect before editing.
2. Reuse existing working code.
3. Do not rewrite another member's core implementation unnecessarily.
4. Do not invent interfaces when existing interfaces are available.
5. Do not invent fake success.
6. Clearly label mocks.
7. Keep changes incremental.
8. Run tests after meaningful changes.
9. Update documentation after each major phase.
10. Never hard-code secrets.
11. Never store plaintext passwords.
12. Use parameterized SQL.
13. Validate all external input.
14. Protect user-owned resources.
15. Do not expose internal stack traces.
16. Do not add infrastructure without a real need.
17. Prefer simple maintainable architecture.
18. Keep external-service integrations behind adapters/services.
19. Preserve the frontend/API contract.
20. Report actual implementation status honestly.

---

# 49. Implementation Phases

The work should be completed in this order.

## Phase 0 — Repository Audit

Output:

- architecture understanding
- existing code inventory
- missing components
- implementation plan

No major code changes.

## Phase 1 — Backend Foundation

Implement:

- server
- routes
- middleware
- health endpoint
- configuration
- error handling

## Phase 2 — XAMPP MySQL + Database

Implement:

- schema.sql
- database creation
- tables
- relationships
- indexes
- connection pool

## Phase 3 — Authentication

Implement:

- registration
- login
- JWT
- authentication middleware
- current-user endpoint

## Phase 4 — CRUD APIs

Implement:

- saved places
- route history
- incidents

## Phase 5 — Dynamic Directions

Implement:

```text
POST /api/directions/dynamic
```

## Phase 6 — ML + Routing Integration

Connect actual Member 1 and Member 2 interfaces.

## Phase 7 — External Services

Connect:

- Valhalla
- OSRM
- Nominatim
- Overpass

## Phase 8 — Postman Testing

Create and execute complete API test collection.

## Phase 9 — Debugging and Integration

Fix:

- API issues
- database issues
- authentication issues
- ML integration issues
- routing integration issues
- external service issues
- frontend contract issues

## Phase 10 — Final Documentation and Demo

Complete:

- backend guide
- API reference
- Postman guide
- testing report
- limitations
- viva preparation
- final demonstration procedure

---

# 50. Required Final Deliverables

Member 3 should ultimately deliver:

```text
Backend application
Database schema
MySQL/XAMPP setup
JWT authentication
Saved-place APIs
Route-history APIs
Incident APIs
Dynamic directions API
ML integration adapter
Routing integration adapter
Navigation fallback adapter
Geocoding adapter
POI adapter
Validation
Error handling
Database pooling
Database indexes
Postman collection
Automated/manual tests
Documentation
Viva preparation
```

Expected important files, adapted to the actual repository:

```text
api/
database/schema.sql
docs/MEMBER3_BACKEND_GUIDE.md
docs/API_REFERENCE.md
docs/POSTMAN_GUIDE.md
.env.example
```

---

# 51. Completion Rule

Member 3 is considered complete only when the implementation has been:

1. coded,
2. configured,
3. tested,
4. debugged,
5. documented,
6. integrated with available ML/routing components,
7. verified through Postman,
8. verified against the frontend contract,
9. and honestly documented for any unavailable dependency.

The final system should support the project's intended end-to-end behavior:

```text
User Input
   ↓
React Frontend
   ↓
POST /api/directions/dynamic
   ↓
Backend Validation
   ↓
ML Traffic Prediction
   ↓
Dynamic Routing
   ↓
Incident-aware Re-routing
   ↓
Route + Chunk Metadata + ETA + Maneuvers
   ↓
Frontend Map
```

The backend is the integration layer. It should not duplicate the responsibilities of the ML, routing, or frontend members.

---

# 52. Documentation Update Rule

After every significant implementation step, update:

```text
docs/MEMBER3_BACKEND_GUIDE.md
```

Each update should contain:

- what was implemented
- why it exists
- files changed
- how it works
- how to run it
- how to test it
- expected result
- common errors
- current implementation status

The purpose is that the final developer can understand and explain the entire Member 3 backend rather than merely possessing code that happens to run.
