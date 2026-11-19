# TerraNav / ChunkFlow Architecture Status

## Current live route path

```text
React + Leaflet Directions UI
  -> Express POST /api/directions/dynamic
    -> validate requested coordinates and mode
    -> request a mode-specific TomTom route where configured
       -> retain provider distance, geometry, steps, duration, and traffic metrics
       -> reject routes whose sections report unsupported `other` mode
    -> for car only, configured OSRM driving fallback
    -> return provider-backed route, or an explicit provider error
```

TomTom's traffic-aware route request asks for traffic and the provider's duration variants. Provider duration is authoritative. Its already traffic-aware ETA is not multiplied a second time. Where the provider exposes live traffic, historic traffic, and no-traffic duration, those values and provenance are preserved. Missing provider data is represented as missing/unavailable, not inferred.

## ML and graph research path

The Python serving API and offline artifacts remain available for research/schema checks. The clean model target was generated synthetically and the Bengaluru graph is a static corridor/intersection representation with connector geometry. Neither is used in live route costs. The Node ML bridge no longer fabricates absent feature values or spawns a one-off worker per request. Live ML strategies return an explicit unavailable response until real inputs and a suitable graph exist.

## Traffic ingestion and rerouting APIs

- `POST /api/directions/traffic-update` validates supplied observations and is disabled unless `TERRANAV_TRAFFIC_UPDATE_TOKEN` is configured. Supplied records require source and a recent timezone-aware timestamp, with validated speed/closure fields.
- `POST /api/directions/reroute` exposes a service evaluation endpoint, but a production active-trip integration/controller lifecycle is not established by the current UI and graph. It must not be described as a deployed dynamic ML rerouting system.
- `GET /api/directions/network` reports research network availability and limitations.

## Persistence and deployment

Express can use MySQL/MariaDB or an explicitly enabled in-memory fallback. In-memory mode is not durable. A browser smoke check was performed against that fallback because MySQL was not available. Production persistence requires configuring and validating the database.

## Provider caveats

TomTom supports traffic-aware duration variants, but mode support is route-section dependent; an `other` section invalidates the requested-mode route in this application. Motorcycle support is beta. Current fallback OSRM is a driving router and is not used to label motorcycle, bicycle, or pedestrian routes.
