# Remaining Limitations

## Live ML routing

The packaged speed model was trained against a synthetic speed target. Its feature vectors and offline validation do not establish measured real-world accuracy. The application therefore excludes its output from live route cost/ETA and reports ML routing unavailable. Completion requires real measured labels, a trusted feature feed matching the clean schema, and external validation.

## Road graph and dynamic rerouting

The offline graph is not a complete, road-following, mode-aware production network. Connector geometry between intersections must not be presented as road shape. Production graph optimization, closure handling, active-trip state, and frontend reroute lifecycle still need implementation against a real network and current traffic observations.

## Traffic freshness and coverage

TomTom provides traffic-aware durations when available. In the observed flow API responses, timestamps were absent; fetch time is not equivalent to provider observation time. Traffic can be unavailable or not materially different from free flow. The application must continue to expose source/availability and avoid fabricating traffic state.

## Travel mode coverage

TomTom returned complete bicycle and pedestrian routes for the diagnostic corridor. Tested car and motorcycle responses included `other` route sections and were rejected. OSRM supplied a car fallback. Motorcycle fallback was unavailable because the configured Valhalla service at `localhost:8002` was not running. TomTom documents motorcycle support as beta.

## Persistence and visual verification

MySQL/MariaDB was not available in the run. The UI smoke test used the in-memory database mode, which cannot verify durable Saved or History records. Desktop Directions UI and browser console were checked. Tablet/mobile screenshot comparison and full interactive route submission were not completed.

## Operational checks

Python tests pass with scikit-learn version and feature-name warnings. The frontend bundle builds but Vite warns that a JavaScript chunk exceeds 500 kB. No lint/typecheck script is configured in the package manifests.
