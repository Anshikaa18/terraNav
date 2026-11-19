# Final Integration Audit — Verified Status

Updated: 2026-10-24. This document supersedes earlier claims in this report that described synthetic model outputs, the offline intersection graph, or all four route modes as production-ready live routing.

## Verified application behavior

- The React/Leaflet UI builds and its frontend unit tests pass.
- Express provides provider-based route planning. TomTom is asked for traffic-aware routes and duration variants; the provider's duration remains authoritative, so traffic is not double-counted.
- A route is rejected when requested-mode sections are returned as `other`. OSRM can provide a car fallback; it is never relabeled as bicycle, pedestrian, or motorcycle routing.
- TomTom flow and incident API calls returned successful responses during the provider diagnostics. Observed flow responses did not include provider timestamps; the app does not turn fetch time into a claim of provider observation freshness.
- The Python model and offline corridor graph remain research-only and do not influence live route costs. Live ML routing is explicitly unavailable until real measured labels, complete trustworthy inputs, and suitable graph data are available.

## Known runtime limits

- In the tested Raipur corridor, bicycle and pedestrian had complete TomTom route data. Car and motorcycle route responses contained `other` sections; car fell back to OSRM, while motorcycle was unavailable because local Valhalla at port 8002 refused connections.
- MySQL/MariaDB was unavailable for browser smoke testing, so the app was run with the explicit in-memory fallback. Durable persistence was not verified.
- UI browser verification confirmed the Directions page rendered and the console had no errors/warnings; it did not include responsive screenshot comparison or a full route submit test.

## Evidence

See [`final_test_results.md`](final_test_results.md), [`final_architecture.md`](final_architecture.md), and [`remaining_limitations.md`](remaining_limitations.md). Provider behavior was checked against [TomTom Routing API v1 documentation](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route).
