# TomTom Traffic integration

ChunkFlow reads `TOMTOM_API_KEY` only on the backend. Do not put it in a frontend `VITE_*` variable, source file, archive, or Git history.

Copy the empty setting from `.env.example` into the runtime `.env`, set a valid TomTom key locally, restart the backend, then run:

```powershell
node backend/scripts/diagnose_tomtom_india.js
```

The diagnostic queries a Raipur major road, a Raipur smaller street, Raipur Ring Road, and Bengaluru MG Road. It records HTTP status, speed/free-flow fields, confidence, response fields, incident response status/count, and whether an observation is usable. A 200 response is not sufficient: `usableTrafficObservation` must be true.

The adapter emits `live` only when both current and free-flow speeds plus direction-matchable geometry are returned and used in motor-vehicle ETA. It emits `fallback` when ML/routing estimates are used, and `unavailable` when no usable fallback exists. TomTom flow payloads do not provide a guaranteed per-segment observation timestamp in the supported response shape; ChunkFlow reports fetch time and does not invent one.

## TomTom Search and ML context

With `GEOCODING_PROVIDER=tomtom` and a backend `TOMTOM_API_KEY`, `/api/services/geocode` uses TomTom Fuzzy Search and `/api/services/reverse` uses TomTom Reverse Geocoding. The key stays on the server. If TomTom is unavailable, rate-limited, or unauthorized, ChunkFlow falls back to Nominatim and does not label those results as TomTom data. Set `GEOCODING_PROVIDER=nominatim` to force the fallback provider.

Run `node backend/scripts/diagnose_tomtom_search.js` after changing the key. It tests Raipur Railway Station, Bengaluru MG Road, and reverse geocoding at Raipur GE Road, recording HTTP status and returned result fields without printing the credential.

TomTom Flow's current and free-flow speeds are used directly for route duration only after a direction-safe road match. They are intentionally not transformed into ChunkFlow's speed-model features, because that would leak the prediction target. TomTom's `roadClosure` is used as an exogenous ML incident-delay feature (900 seconds); normal traffic flow remains a direct ETA input rather than an ML target feature.

## TomTom Maps basemap

TomTom Maps is available in the map-style picker as **TomTom Maps**. Leaflet requests `/api/maps/tomtom/tiles/{z}/{x}/{y}.png`; the backend proxies the Basic raster tile request with `TOMTOM_API_KEY`. No TomTom key is included in frontend source, environment variables, or browser tile URLs. Tile coordinates are validated and successful tiles are cacheable for five minutes.

Verified on 22 October 2026 with a configured backend key: usable Flow observations were returned for Raipur GE Road, Raipur Samta Colony, Raipur Ring Road, and Bengaluru MG Road, and the Incidents API returned 200 for all four corridor checks. A Raipur observation of 24 km/h current versus 31 km/h free-flow changed a 300-second motor ETA to 388 seconds after direction matching. Coverage may vary by exact road, time, and account entitlement; rerun the diagnostic after changing keys or provider configuration.
