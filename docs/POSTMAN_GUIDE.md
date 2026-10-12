# TerraNav AI — Postman Testing Guide

**Member 3: Backend Integration & Microservices**  
**Collection File:** `postman/terranav.postman_collection.json`

---

## 1. Quick Import Guide

1. Open **Postman**.
2. Click the **Import** button in the top left workspace corner.
3. Select `d:/terraNav/postman/terranav.postman_collection.json`.
4. The imported collection `TerraNav AI — Member 3 Complete Backend API Suite` will appear in your left sidebar.

---

## 2. Collection Variables

The collection contains configured environment variables that auto-populate between requests:

| Variable | Initial Value | Description |
|---|---|---|
| `baseUrl` | `http://localhost:5000` | Host and port of the backend server |
| `jwtToken` | `""` | Auto-populated by `Register` or `Login` requests |
| `savedPlaceId` | `"1"` | Auto-populated by `Create Saved Place` |
| `incidentId` | `"1"` | Auto-populated by `Report Incident` |
| `historyId` | `"1"` | Auto-populated by `Log Route History` |

---

## 3. Recommended Sequential Test Run

Run requests in this exact order to test state propagation across MySQL / JWT:

1. **01 Health / GET Health Check**
   - Verify server is healthy and reporting DB status.
2. **02 Authentication / POST Register User**
   - Registers test user; auto-stores `jwtToken`.
3. **02 Authentication / POST Login User**
   - Verifies credentials and JWT creation.
4. **02 Authentication / GET Current User (Me)**
   - Tests protected endpoint using Bearer token.
5. **03 Saved Places / POST Create Saved Place**
   - Saves location; stores `savedPlaceId`.
6. **03 Saved Places / GET List Saved Places**
   - Confirms user can list their own saved places.
7. **03 Saved Places / PUT Update Saved Place**
   - Tests partial updates on existing bookmark.
8. **03 Saved Places / DELETE Saved Place**
   - Deletes saved location.
9. **04 Route History / POST Log Route History**
   - Records trip log.
10. **04 Route History / GET List Route History**
    - Retrieves trip history.
11. **05 Incidents / POST Report Incident**
    - Reports road blockage on `CHUNK_104`.
12. **05 Incidents / GET List Active Incidents**
    - Checks incident state.
13. **06 Dynamic Directions / POST Dynamic Directions (Standard)**
    - Verifies ML speed prediction, chunk decomposition, and ETA savings.
14. **06 Dynamic Directions / POST Dynamic Directions with Incident Simulation**
    - Simulates accident on `CHUNK_104` and verifies adjusted cost.
15. **06 Dynamic Directions / POST Dynamic Directions (Roadblock Reroute Detour)**
    - Verifies dynamic reroute path around blocked chunk.
16. **08 Negative Tests / All Requests**
    - Verifies HTTP 400, 401, and 404 security guardrails.

---

## 4. Automatic Test Script Validation

Each request in the collection is pre-configured with Postman test scripts that validate:
- Status codes (`pm.response.to.have.status(200)`)
- Response times (`pm.expect(pm.response.responseTime).to.be.below(1500)`)
- JSON Schema compliance (`pm.expect(jsonData.success).to.be.true`)
