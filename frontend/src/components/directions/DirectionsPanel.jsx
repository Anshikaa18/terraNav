import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeftRight, Navigation, MapPin, X, Loader2, Route, ChevronDown, ChevronUp, IndianRupee, Milestone, Sparkles } from 'lucide-react';
import { useMap } from '../../context/MapContext.jsx';
import { directionService } from '../../services/directionService.js';
import { mapService } from '../../services/mapService.js';
import TransportSelector from './TransportSelector.jsx';
import TurnByTurnList from './TurnByTurnList.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { toLatLng, isValidLatLng } from '../../utils/coordinates.js';
import AutocompleteMenu from './AutocompleteMenu.jsx';
import { formatDuration } from '../../utils/geo.js';
import TrafficMeter from './TrafficMeter.jsx';

export default function DirectionsPanel({ initialTo = null, initialToName = '', initialFrom = null, initialFromName = '', initialMode = 'driving', onClose = null }) {
  const { setRouteData, setActiveRoute, clearRoute, userLocation, currentLocation, center, locateUser, isLocating } = useMap();
  const routeRequestRef = useRef(null);
  const autocompleteRequestRef = useRef({ from: null, to: null });
  const fromAnchorRef = useRef(null);
  const toAnchorRef = useRef(null);

  const [fromQuery, setFromQuery] = useState(initialFromName || '');
  const [fromCoords, setFromCoords] = useState(initialFrom ? toLatLng(initialFrom) : null);
  const [toQuery, setToQuery] = useState(initialToName || '');
  const [toCoords, setToCoords] = useState(initialTo ? toLatLng(initialTo) : null);

  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [routeResponse, setRouteResponse] = useState(null);

  // Suggestions state
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [fromSearchError, setFromSearchError] = useState(null);
  const [toSearchError, setToSearchError] = useState(null);
  const [fromSearchLoading, setFromSearchLoading] = useState(false);
  const [toSearchLoading, setToSearchLoading] = useState(false);
  const [activeInput, setActiveInput] = useState(null);

  const debouncedFrom = useDebounce(fromQuery, 300);
  const debouncedTo = useDebounce(toQuery, 300);

  const clearRouteResult = useCallback(() => {
    setRoutes([]);
    setRouteResponse(null);
    setActiveRouteIndex(0);
    setShowSteps(false);
    clearRoute();
  }, [clearRoute]);

  const invalidateRoute = useCallback(() => {
    routeRequestRef.current?.abort();
    clearRouteResult();
    setLoading(false);
    setError(null);
  }, [clearRouteResult]);

  // Sync initial URL coordinates
  useEffect(() => {
    if (initialTo) {
      const pt = toLatLng(initialTo);
      if (pt && isValidLatLng(pt)) {
        setToCoords(pt);
        if (initialToName) {
          setToQuery(initialToName);
        } else if (!toQuery) {
          setToQuery(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
        }
      }
    }
  }, [initialTo, initialToName]);

  useEffect(() => {
    if (initialFrom) {
      const pt = toLatLng(initialFrom);
      if (pt && isValidLatLng(pt)) {
        setFromCoords(pt);
        if (initialFromName) {
          setFromQuery(initialFromName);
        } else if (!fromQuery) {
          setFromQuery(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
        }
      }
    }
  }, [initialFrom, initialFromName]);

  // Autocomplete search for FROM
  useEffect(() => {
    if (activeInput !== 'from' || !debouncedFrom || debouncedFrom.length < 2) {
      setFromSuggestions([]);
      return;
    }
    const directPt = toLatLng(debouncedFrom);
    if (directPt && isValidLatLng(directPt)) {
      setFromCoords(directPt);
      setFromSuggestions([]);
      return;
    }

    const controller = new AbortController();
    autocompleteRequestRef.current.from?.abort();
    autocompleteRequestRef.current.from = controller;
    const bias = currentLocation || userLocation || toCoords || center;
    const biasPoint = toLatLng(bias);
    setFromSearchLoading(true);
    setFromSearchError(null);
    mapService.searchPlaces(debouncedFrom, biasPoint?.lat ?? null, biasPoint?.lng ?? null, 5, { signal: controller.signal })
      .then((places) => { if (!controller.signal.aborted) setFromSuggestions(places); })
      .catch((err) => { if (!controller.signal.aborted) { setFromSuggestions([]); setFromSearchError(err.message || 'Location search is temporarily unavailable.'); } })
      .finally(() => { if (!controller.signal.aborted) setFromSearchLoading(false); });
    return () => controller.abort();
  }, [debouncedFrom, activeInput, currentLocation, userLocation, toCoords, center]);

  // Autocomplete search for TO
  useEffect(() => {
    if (activeInput !== 'to' || !debouncedTo || debouncedTo.length < 2) {
      setToSuggestions([]);
      return;
    }
    const directPt = toLatLng(debouncedTo);
    if (directPt && isValidLatLng(directPt)) {
      setToCoords(directPt);
      setToSuggestions([]);
      return;
    }

    const controller = new AbortController();
    autocompleteRequestRef.current.to?.abort();
    autocompleteRequestRef.current.to = controller;
    const bias = fromCoords || currentLocation || userLocation || center;
    const biasPoint = toLatLng(bias);
    setToSearchLoading(true);
    setToSearchError(null);
    mapService.searchPlaces(debouncedTo, biasPoint?.lat ?? null, biasPoint?.lng ?? null, 5, { signal: controller.signal })
      .then((places) => { if (!controller.signal.aborted) setToSuggestions(places); })
      .catch((err) => { if (!controller.signal.aborted) { setToSuggestions([]); setToSearchError(err.message || 'Location search is temporarily unavailable.'); } })
      .finally(() => { if (!controller.signal.aborted) setToSearchLoading(false); });
    return () => controller.abort();
  }, [debouncedTo, activeInput, fromCoords, currentLocation, userLocation, center]);

  const calculateRoute = useCallback(async () => {
    if (!fromCoords || !toCoords) {
      clearRouteResult();
      return;
    }
    routeRequestRef.current?.abort();
    const controller = new AbortController();
    routeRequestRef.current = controller;
    clearRouteResult();
    setLoading(true);
    setError(null);
    try {
      const data = await directionService.getDirections(fromCoords, toCoords, mode, {
        signal: controller.signal,
        originName: fromQuery || `${fromCoords.lat}, ${fromCoords.lng}`,
        destinationName: toQuery || `${toCoords.lat}, ${toCoords.lng}`
      });
      if (controller.signal.aborted) return;
      if (data?.routes && data.routes.length > 0) {
        setRoutes(data.routes);
        setRouteResponse(data);
        const selectedIndex = Math.max(0, data.routes.findIndex((route) => (route.routeId || route.id) === data.selectedRouteId));
        setActiveRouteIndex(selectedIndex);
        setRouteData(data);
      } else {
        clearRouteResult();
        setError({ message: 'No route could be found between these locations. Try a different destination.' });
      }
    } catch (err) {
      if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
      clearRouteResult();
      const profileUnavailable = err?.code === 'ROUTING_PROFILE_UNAVAILABLE' || err?.code === 'VALHALLA_UNAVAILABLE';
      const modeLabel = mode === 'motorcycle' ? 'Bike' : mode === 'bicycle' ? 'Bicycle' : mode === 'walking' || mode === 'pedestrian' ? 'Walk' : 'Car';
      setError({
        message: profileUnavailable
          ? `${modeLabel} routing is unavailable right now. Try Car or retry after the routing service is available.`
          : (err.message || 'Unable to calculate route. Please try again.'),
        suggestCar: profileUnavailable && mode !== 'driving' && mode !== 'car'
      });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fromCoords, toCoords, mode, fromQuery, toQuery, setRouteData, clearRouteResult]);

  const calculateRouteRef = useRef(calculateRoute);
  calculateRouteRef.current = calculateRoute;

  // Route effects run after calculateRoute is initialized. Keep the latest
  // callback in a ref because context action wrappers are recreated per render.
  useEffect(() => {
    if (fromCoords && toCoords) calculateRouteRef.current();
  }, [fromCoords, toCoords, mode, fromQuery, toQuery]);

  useEffect(() => {
    if (!fromCoords || !toCoords) return undefined;
    const refreshId = window.setInterval(() => calculateRouteRef.current(), 60_000);
    return () => window.clearInterval(refreshId);
  }, [fromCoords, toCoords, mode]);

  useEffect(() => () => {
    routeRequestRef.current?.abort();
    autocompleteRequestRef.current.from?.abort();
    autocompleteRequestRef.current.to?.abort();
  }, []);

  const handleUseCurrentLocation = async () => {
    try {
      const activeLoc = userLocation || currentLocation;
      const loc = activeLoc || (await locateUser());
      const pt = toLatLng(loc);
      if (pt) {
        invalidateRoute();
        setFromCoords(pt);
        setFromQuery('My Location');
        setActiveInput(null);
      }
    } catch (e) {
      invalidateRoute();
      setError({ message: 'Could not find your current location. Enter an origin and try again.' });
    }
  };

  const handleSelectFrom = (place) => {
    const pt = toLatLng(place);
    if (pt) {
      invalidateRoute();
      setFromCoords(pt);
      setFromQuery(place.name || place.displayName);
      setFromSuggestions([]);
      setActiveInput(null);
    }
  };

  const handleSelectTo = (place) => {
    const pt = toLatLng(place);
    if (pt) {
      invalidateRoute();
      setToCoords(pt);
      setToQuery(place.name || place.displayName);
      setToSuggestions([]);
      setActiveInput(null);
    }
  };

  const handleSwap = () => {
    invalidateRoute();
    const tempCoords = fromCoords;
    const tempQuery = fromQuery;
    setFromCoords(toCoords);
    setFromQuery(toQuery);
    setToCoords(tempCoords);
    setToQuery(tempQuery);
  };

  const handleSelectRouteTab = (index) => {
    setActiveRouteIndex(index);
    if (routes[index] && setActiveRoute) {
      setActiveRoute(routes[index].routeId || routes[index].id);
    }
  };

  const handleSelectMode = (nextMode) => {
    if (nextMode === mode) return;
    invalidateRoute();
    setMode(nextMode);
  };

  const activeRoute = routes[activeRouteIndex] || routes[0] || null;

  // Format clean summary without duplicate "VIA VIA"
  const formattedSummary = activeRoute?.summary
    ? activeRoute.summary.toUpperCase().startsWith('VIA ')
      ? activeRoute.summary.toUpperCase()
      : `VIA ${activeRoute.summary.toUpperCase()}`
    : 'DIRECT ROUTE';

  return (
    <div className="w-full h-fit min-h-0 max-h-[min(84dvh,760px)] lg:max-h-[calc(100dvh-2rem)] flex flex-col bg-[var(--surface-raised)] backdrop-blur-md border border-[var(--border)] shadow-[var(--shadow-lg)] select-none rounded-2xl overflow-y-auto overflow-x-visible">
      {/* Header */}
      <div className="sticky top-0 z-40 shrink-0 p-4 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--outline)]/40">
              <Route className="w-4 h-4" />
            </span>
            <div>
              <span className="text-[11px] uppercase font-bold text-[var(--primary)] tracking-wider">Route Planner</span>
              <h2 className="text-base font-bold tracking-tight text-[var(--text)]">
                Dynamic Directions
              </h2>
            </div>
          </div>
          {onClose && (
            <button
              onClick={() => {
                clearRoute();
                onClose();
              }}
              aria-label="Close directions"
              className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--outline)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Transport selector */}
        <TransportSelector activeMode={mode} onSelectMode={handleSelectMode} />
      </div>

      {/* Input Rows */}
      <div className="p-4 space-y-3 relative z-30">
        {/* FROM Input */}
        <div className="relative" ref={fromAnchorRef}>
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase block mb-1.5">
            Origin
          </label>
          <div className="flex items-center w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--outline)] focus-within:ring-2 focus-within:ring-[var(--primary-soft)] transition-all">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--green)] mr-2.5 flex-shrink-0 shadow-[0_0_6px_var(--green)]" />
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => {
                invalidateRoute();
                setFromQuery(e.target.value);
                setFromCoords(null);
              }}
              onFocus={() => setActiveInput('from')}
              placeholder="Origin coordinates or place..."
              className="w-full bg-transparent text-xs font-semibold text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none"
            />
            {fromQuery && (
              <button
                type="button"
                onClick={() => {
                  invalidateRoute();
                  setFromQuery('');
                  setFromCoords(null);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
        {activeInput === 'from' && (!fromCoords || fromSuggestions.length > 0 || fromSearchError || fromSearchLoading) && (
          <AutocompleteMenu anchorRef={fromAnchorRef} side="from" places={fromSuggestions} loading={fromSearchLoading} error={fromSearchError} onSelect={handleSelectFrom} onUseCurrentLocation={handleUseCurrentLocation} />
        )}

        {/* Swap & My Location actions */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="flex items-center space-x-1.5 border-0 bg-transparent px-0 py-0 shadow-none text-[11px] font-semibold text-[var(--primary)] hover:underline"
          >
            <Navigation className="w-3 h-3" />
            <span>Use My Position</span>
          </button>

          <button
            type="button"
            onClick={handleSwap}
            title="Swap Origin and Destination"
            className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--outline)] transition-colors shadow-sm"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 rotate-90" />
          </button>
        </div>

        {/* TO Input */}
        <div className="relative" ref={toAnchorRef}>
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase block mb-1.5">
            Destination
          </label>
          <div className="flex items-center w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--outline)] focus-within:ring-2 focus-within:ring-[var(--primary-soft)] transition-all">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--red)] mr-2.5 flex-shrink-0 shadow-[0_0_6px_var(--red)]" />
            <input
              type="text"
              value={toQuery}
              onChange={(e) => {
                invalidateRoute();
                setToQuery(e.target.value);
                setToCoords(null);
              }}
              onFocus={() => setActiveInput('to')}
              placeholder="Destination coordinates or place..."
              className="w-full bg-transparent text-xs font-semibold text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none"
            />
            {toQuery && (
              <button
                type="button"
                onClick={() => {
                  invalidateRoute();
                  setToQuery('');
                  setToCoords(null);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text)] ml-1 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
        {activeInput === 'to' && (!toCoords || toSuggestions.length > 0 || toSearchError || toSearchLoading) && (
          <AutocompleteMenu anchorRef={toAnchorRef} side="to" places={toSuggestions} loading={toSearchLoading} error={toSearchError} onSelect={handleSelectTo} />
        )}
      </div>

      {/* Status / Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center space-x-2 p-5 text-xs font-semibold text-[var(--primary)] bg-[var(--surface-subtle)] border-t border-[var(--border)]" role="status" aria-live="polite">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
          <span>Calculating route…</span>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-[var(--red)]/10 border border-[var(--red)]/30 text-xs font-medium text-[var(--red)]" role="alert">
          <p>{error.message}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={calculateRoute} disabled={!fromCoords || !toCoords || loading} className="rounded-lg border border-[var(--red)]/40 bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text)] hover:border-[var(--red)] disabled:cursor-not-allowed disabled:opacity-50">
              Retry
            </button>
            {error.suggestCar && (
              <button type="button" onClick={() => handleSelectMode('driving')} className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--primary)] hover:border-[var(--primary)]">
                Use Car
              </button>
            )}
          </div>
        </div>
      )}

      {/* Route Results & Summary Strip */}
      {activeRoute && !loading && (
        <div className="flex-1 overflow-y-auto border-t border-[var(--border)]">
          {/* Alternatives selector tabs */}
          {routes.length > 1 && (
            <div className="flex border-b border-[var(--border)] bg-[var(--surface-subtle)] p-1 gap-1">
              {routes.map((rt, idx) => (
                <button
                  key={rt.routeId || idx}
                  onClick={() => handleSelectRouteTab(idx)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    activeRouteIndex === idx
                      ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm border border-[var(--outline)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)]/50'
                  }`}
                >
                  PATH {idx + 1} ({rt.durationText})
                </button>
              ))}
            </div>
          )}

          {/* Primary Route Hero Card */}
          <div className="sticky top-[136px] z-30 p-4 bg-[var(--surface)] border-t-2 border-[var(--primary)]">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-extrabold text-[var(--primary)] tracking-tight">
                  {activeRoute.durationText}
                </span>
                <span className="ml-2 text-xs font-semibold text-[var(--text-secondary)] font-mono">
                  ({activeRoute.distanceText})
                </span>
              </div>
              <span className="text-[10px] font-bold border border-[var(--green)]/40 px-2 py-0.5 rounded-full text-[var(--green)] bg-[var(--green)]/10 uppercase tracking-wide">
                Route Available
              </span>
            </div>

            <p className="text-xs font-semibold text-[var(--text-secondary)] mt-1 tracking-wide">
              {formattedSummary}
            </p>

            {/* Traffic telemetry disclosure */}
            <div className="mt-3 space-y-1.5">
              {(routeResponse?.traffic?.status === 'live' || routeResponse?.traffic?.status === 'cached') && activeRoute.trafficAdjusted && (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--green)] bg-[var(--green)]/10 border border-[var(--green)]/30 px-2.5 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
                  <span>{routeResponse.traffic.status === 'cached' ? 'CACHED LIVE TRAFFIC USED IN ETA' : 'LIVE TRAFFIC USED IN ETA'}</span>
                  {routeResponse.traffic.observationCount > 0 && (
                    <span className="text-[var(--text-secondary)] text-[9px]">({routeResponse.traffic.observationCount} observations)</span>
                  )}
                  {routeResponse.traffic.sourceUpdated && (
                    <span className="text-[var(--text-secondary)] ml-auto text-[9px]">
                      {new Date(routeResponse.traffic.sourceUpdated).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              {(routeResponse?.traffic?.status === 'live' || routeResponse?.traffic?.status === 'cached') && !activeRoute.trafficAdjusted && (
                <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                  Traffic data was not matched to this route mode; ETA is from the routing provider.
                </div>
              )}

              {routeResponse?.traffic?.status === 'stale' && (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--yellow)] bg-[var(--yellow)]/10 border border-[var(--yellow)]/30 px-2.5 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[var(--yellow)]" />
                  <span>STALE TRAFFIC DATA · ROUTING PROVIDER ETA</span>
                </div>
              )}

              {(routeResponse?.traffic?.status === 'unavailable' || !routeResponse?.traffic?.status) && (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                  <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                  <span>LIVE TRAFFIC UNAVAILABLE · ROUTING PROVIDER ETA</span>
                </div>
              )}

              {['bicycle', 'walking', 'pedestrian'].includes(mode) && routeResponse?.traffic?.status !== 'unavailable' && (
                <div className="text-[10px] text-[var(--text-secondary)]">ETA uses the selected {mode === 'bicycle' ? 'bicycle' : 'walking'} routing profile; motor-vehicle traffic speeds are not applied.</div>
              )}

              <TrafficMeter
                segments={activeRoute?.segments || []}
                status={routeResponse?.traffic?.status}
              />

              {/* Honest travel time comparison */}
              {activeRoute.trafficAdjusted && activeRoute.timeSavedSeconds > 0 && (
                <div className="text-[10px] font-semibold text-[var(--green)]">
                  Live traffic adjusted the routing estimate by {formatDuration(activeRoute.timeSavedSeconds)}
                </div>
              )}
              {activeRoute.trafficAdjusted && activeRoute.timeSavedSeconds < 0 && (
                <div className="text-[10px] font-semibold text-[var(--yellow)]">
                  Live traffic added {formatDuration(Math.abs(activeRoute.timeSavedSeconds))} to the routing estimate
                </div>
              )}
            </div>

            {/* Toll / expressway flags */}
            {(activeRoute.hasToll || activeRoute.hasHighway) && (
              <div className="flex items-center flex-wrap gap-1.5 mt-2.5 text-[10px] font-bold">
                {activeRoute.hasToll && (
                  <span className="flex items-center space-x-1 border border-[var(--yellow)]/40 px-2 py-0.5 rounded-md text-[var(--yellow)] bg-[var(--yellow)]/10">
                    <IndianRupee className="w-3 h-3" />
                    <span>TOLL ROAD</span>
                  </span>
                )}
                {activeRoute.hasHighway && (
                  <span className="flex items-center space-x-1 border border-[var(--primary)]/40 px-2 py-0.5 rounded-md text-[var(--primary)] bg-[var(--primary-soft)]">
                    <Milestone className="w-3 h-3" />
                    <span>EXPRESSWAY</span>
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setShowSteps(!showSteps)}
              className="mt-3.5 w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--outline)] transition-colors"
            >
              <span>{showSteps ? 'HIDE' : 'VIEW'} TURN-BY-TURN STEPS ({activeRoute.steps?.length || 0})</span>
              {showSteps ? <ChevronUp className="w-4 h-4 text-[var(--primary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--primary)]" />}
            </button>
          </div>

          {/* Turn-by-turn steps accordion */}
          {showSteps && (
            <TurnByTurnList steps={activeRoute.steps} />
          )}
        </div>
      )}
    </div>
  );
}
