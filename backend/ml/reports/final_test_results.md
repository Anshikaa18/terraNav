# Final Test Results

Date: 2026-10-24. These results describe this workspace and the tools/providers available during the run.

## Automated checks

| Check | Result | Notes |
|---|---|---|
| Frontend unit tests (`npm test`, in `terraNav/frontend`) | Passed, 11/11 | Node test runner. |
| Backend suite (`npm run test:all`, in `terraNav`) | Passed, exit code 0 | Includes auth/config, incidents, CORS/rate limits, history, ML schema, TomTom traffic/maps/routing, traffic update authorization, core routing, traffic matching, provider fallback, search, and ML context suites. |
| Python suite (`python -m pytest -q`, from repository root) | Passed, 22/22 | scikit-learn emitted version/feature-name warnings; no test failures. |
| Frontend production build (`npm run build`, in `terraNav/frontend`) | Passed | Vite emitted a >500 kB JavaScript chunk warning. Bundle was about 541.40 kB (158.96 kB gzip). |
| JavaScript syntax checks | Passed | Changed backend routing/controller/adapter modules and provider mode diagnostic. |

No separate lint or typecheck script is defined in the package manifests, so those were not run.

## Provider/API checks

- `node backend/scripts/diagnose_tomtom_india.js` made four live TomTom flow corridor requests and one incidents request; all returned HTTP 200. The observations had no provider timestamp, so the script correctly reports fetch-time rather than asserting freshness. The observed corridors showed no speed reduction against free flow at the time.
- `node backend/scripts/diagnose_tomtom_routing_modes.js` geocoded a Raipur origin/destination and requested actual route data. Bicycle (3 alternatives) and pedestrian returned complete TomTom routes. The tested car and motorcycle responses included `other` sections, so the backend rejected those as incomplete for the requested mode. Car fallback through OSRM succeeded. Motorcycle remained unavailable because configured Valhalla at `localhost:8002` refused the connection.
- TomTom API behavior was checked against the official [TomTom Routing API v1 documentation](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route): traffic-aware calculation and duration variants are supported, and sections can report `other` when a requested mode is unsupported. Motorcycle support is beta.

## Browser check

The running app was opened at `http://127.0.0.1:5001/directions`. The page showed the map and Leaflet/OSM attribution, top navigation, travel-mode selector, origin/destination fields, map controls, and traffic legend. Browser console reported zero errors and zero warnings after fixing the same-origin geolocation policy. This was a render/smoke check, not an automated responsive screenshot comparison or a complete route submission flow.

MySQL was unavailable. Browser startup used `ALLOW_IN_MEMORY_DB=true`; therefore browser checks did not establish database persistence across refresh/restart. The browser Directions panel was visually inspected at the current desktop viewport; tablet/mobile screenshot comparison was not performed in this run.

## Interpretation

The test suites validate the API contracts and research-model guardrails. They do not establish a production ML traffic model, live end-to-end ML routing, persistence against a running MySQL instance, or a working motorcycle route for this tested corridor. Those are documented as pending rather than counted as completed.
