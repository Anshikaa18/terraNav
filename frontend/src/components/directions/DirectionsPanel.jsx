import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Navigation, MapPin, X, Loader2, Route, ChevronDown, ChevronUp, IndianRupee, Milestone } from 'lucide-react';
import { useMap } from '../../context/MapContext.jsx';
import { directionService } from '../../services/directionService.js';
import { mapService } from '../../services/mapService.js';
import TransportSelector from './TransportSelector.jsx';
import TurnByTurnList from './TurnByTurnList.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { toLatLng, isValidLatLng } from '../../utils/coordinates.js';

export default function DirectionsPanel({ initialTo = null, initialToName = '', initialFrom = null, initialFromName = '', onClose = null }) {
  const { setRouteData, clearRoute, userLocation, currentLocation, locateUser, isLocating } = useMap();

  const [fromQuery, setFromQuery] = useState(initialFromName ? decodeURIComponent(initialFromName) : '');
  const [fromCoords, setFromCoords] = useState(initialFrom ? toLatLng(initialFrom) : null);
  const [toQuery, setToQuery] = useState(initialToName ? decodeURIComponent(initialToName) : '');
  const [toCoords, setToCoords] = useState(initialTo ? toLatLng(initialTo) : null);

  const [mode, setMode] = useState('driving');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [routes, setRoutes] = useState([]);

  // Suggestions state
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);

  const debouncedFrom = useDebounce(fromQuery, 300);
  const debouncedTo = useDebounce(toQuery, 300);

  // Sync initial URL coordinates
  useEffect(() => {
    if (initialTo) {
      const pt = toLatLng(initialTo);
      if (pt && isValidLatLng(pt)) {
        setToCoords(pt);
        if (initialToName) {
          setToQuery(decodeURIComponent(initialToName));
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
          setFromQuery(decodeURIComponent(initialFromName));
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
    // Check if user entered direct coordinates like "21.2449, 81.6335"
    const directPt = toLatLng(debouncedFrom);
    if (directPt && isValidLatLng(directPt)) {
      setFromCoords(directPt);
      setFromSuggestions([]);
      return;
    }

    mapService.searchPlaces(debouncedFrom, null, null, 5)
      .then(places => setFromSuggestions(places))
      .catch(() => setFromSuggestions([]));
  }, [debouncedFrom, activeInput]);

  // Autocomplete search for TO
  useEffect(() => {
    if (activeInput !== 'to' || !debouncedTo || debouncedTo.length < 2) {
      setToSuggestions([]);
      return;
    }
    // Check if user entered direct coordinates
    const directPt = toLatLng(debouncedTo);
    if (directPt && isValidLatLng(directPt)) {
      setToCoords(directPt);
      setToSuggestions([]);
      return;
    }

    mapService.searchPlaces(debouncedTo, null, null, 5)
      .then(places => setToSuggestions(places))
      .catch(() => setToSuggestions([]));
  }, [debouncedTo, activeInput]);

  // Trigger calculation when both coordinates and mode are set
  useEffect(() => {
    if (fromCoords && toCoords) {
      calculateRoute();
    }
  }, [fromCoords, toCoords, mode]);

  const calculateRoute = async () => {
    if (!fromCoords || !toCoords) return;

    setLoading(true);
    setError(null);
    try {
      const data = await directionService.getDirections(fromCoords, toCoords, mode);
      if (data?.routes && data.routes.length > 0) {
        setRoutes(data.routes);
        setActiveRouteIndex(0);
        setRouteData(data);
      } else {
        setError('No route could be found between these locations.');
      }
    } catch (err) {
      setError(err.message || 'Unable to calculate route. Please try another destination.');
      clearRoute();
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const activeLoc = userLocation || currentLocation;
      const loc = activeLoc || (await locateUser());
      const pt = toLatLng(loc);
      if (pt) {
        setFromCoords(pt);
        setFromQuery('My Position (GPS)');
        setFromSuggestions([]);
        setActiveInput(null);
      }
    } catch (err) {
      setError('Location access was denied or unavailable. Please enable GPS permissions.');
    }
  };

  const handleSwap = () => {
    const tempQ = fromQuery;
    const tempC = fromCoords;
    setFromQuery(toQuery);
    setFromCoords(toCoords);
    setToQuery(tempQ);
    setToCoords(tempC);
  };

  const handleSelectFrom = (place) => {
    const pt = toLatLng(place);
    if (pt) {
      setFromQuery(place.name || place.display_name?.split(',')[0] || `${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
      setFromCoords(pt);
      setFromSuggestions([]);
      setActiveInput(null);
    }
  };

  const handleSelectTo = (place) => {
    const pt = toLatLng(place);
    if (pt) {
      setToQuery(place.name || place.display_name?.split(',')[0] || `${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
      setToCoords(pt);
      setToSuggestions([]);
      setActiveInput(null);
    }
  };

  const activeRoute = routes[activeRouteIndex] || null;

  return (
    <div className="w-full flex flex-col bg-[#11171b]/98 backdrop-blur-md border border-[#29353a] shadow-[0_16px_40px_rgba(0,0,0,0.7)] select-none">
      {/* Header */}
      <div className="p-4 border-b border-[#29353a] bg-[#162024]/70">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Route className="w-4 h-4 text-[#63e7ee]" />
            <h2 className="font-condensed text-xl font-bold tracking-wide text-[#edf3f1]">
              DYNAMIC ROUTING
            </h2>
          </div>
          {onClose && (
            <button
              onClick={() => {
                clearRoute();
                onClose();
              }}
              className="p-1 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#edf3f1] hover:border-[#63e7ee]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Transport selector */}
        <TransportSelector activeMode={mode} onSelectMode={setMode} />
      </div>

      {/* Input Rows */}
      <div className="p-4 space-y-2.5 relative">
        {/* FROM Input */}
        <div className="relative">
          <div className="flex items-center w-full px-3 py-2 rounded bg-[#172125] border border-[#38474b] focus-within:border-[#63e7ee] transition-colors">
            <div className="w-2.5 h-2.5 rounded-full bg-[#61dfab] mr-2.5 flex-shrink-0 shadow-[0_0_6px_#61dfab]" />
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => {
                setFromQuery(e.target.value);
                setFromCoords(null);
              }}
              onFocus={() => setActiveInput('from')}
              placeholder="ORIGIN COORDINATES OR PLACE..."
              className="w-full bg-transparent font-mono text-xs text-[#edf3f1] placeholder-[#586769] uppercase focus:outline-none"
            />
            {fromQuery && (
              <button
                type="button"
                onClick={() => {
                  setFromQuery('');
                  setFromCoords(null);
                }}
                className="text-[#8c9a9c] hover:text-[#edf3f1] ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete for FROM */}
          {activeInput === 'from' && fromSuggestions.length > 0 && (
            <div className="absolute top-11 left-0 right-0 z-50 rounded bg-[#11171b]/98 border border-[#38484e] shadow-[0_12px_36px_rgba(0,0,0,0.7)] py-1 max-h-48 overflow-y-auto">
              <button
                onClick={handleUseCurrentLocation}
                className="w-full flex items-center space-x-2 px-3 py-2 font-mono text-xs text-[#63e7ee] hover:bg-[#162024]"
              >
                <Navigation className="w-3 h-3" />
                <span>USE CURRENT GPS TELEMETRY</span>
              </button>
              {fromSuggestions.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelectFrom(place)}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left hover:bg-[#162024] font-mono"
                >
                  <MapPin className="w-3 h-3 text-[#63e7ee] flex-shrink-0" />
                  <span className="text-xs text-[#edf3f1] truncate">{place.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap button floating */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="flex items-center space-x-1 font-mono text-[10px] text-[#63e7ee] hover:underline uppercase"
          >
            <Navigation className="w-3 h-3" />
            <span>MY POSITION</span>
          </button>

          <button
            type="button"
            onClick={handleSwap}
            title="Swap Origin and Destination"
            className="p-1 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-colors"
          >
            <ArrowLeftRight className="w-3 h-3 rotate-90" />
          </button>
        </div>

        {/* TO Input */}
        <div className="relative">
          <div className="flex items-center w-full px-3 py-2 rounded bg-[#172125] border border-[#38474b] focus-within:border-[#63e7ee] transition-colors">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5d61] mr-2.5 flex-shrink-0 shadow-[0_0_6px_#ff5d61]" />
            <input
              type="text"
              value={toQuery}
              onChange={(e) => {
                setToQuery(e.target.value);
                setToCoords(null);
              }}
              onFocus={() => setActiveInput('to')}
              placeholder="DESTINATION COORDINATES OR PLACE..."
              className="w-full bg-transparent font-mono text-xs text-[#edf3f1] placeholder-[#586769] uppercase focus:outline-none"
            />
            {toQuery && (
              <button
                type="button"
                onClick={() => {
                  setToQuery('');
                  setToCoords(null);
                }}
                className="text-[#8c9a9c] hover:text-[#edf3f1] ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete for TO */}
          {activeInput === 'to' && toSuggestions.length > 0 && (
            <div className="absolute top-11 left-0 right-0 z-50 rounded bg-[#11171b]/98 border border-[#38484e] shadow-[0_12px_36px_rgba(0,0,0,0.7)] py-1 max-h-48 overflow-y-auto">
              {toSuggestions.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelectTo(place)}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left hover:bg-[#162024] font-mono"
                >
                  <MapPin className="w-3 h-3 text-[#ff5d61] flex-shrink-0" />
                  <span className="text-xs text-[#edf3f1] truncate">{place.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status / Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center space-x-2 p-6 font-mono text-xs text-[#63e7ee] bg-[#0d1215]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>CALCULATING SHORTEST PATH OVER ROAD CHUNKS...</span>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-4 p-3 rounded bg-[#ff5d61]/10 border border-[#ff5d61]/40 font-mono text-xs text-[#ff5d61]">
          {error}
        </div>
      )}

      {/* Route Results & Summary Strip */}
      {activeRoute && !loading && (
        <div className="flex-1 overflow-y-auto border-t border-[#29353a]">
          {/* Alternatives selector tabs */}
          {routes.length > 1 && (
            <div className="flex border-b border-[#29353a] font-mono text-[10px]">
              {routes.map((rt, idx) => (
                <button
                  key={rt.id}
                  onClick={() => setActiveRouteIndex(idx)}
                  className={`flex-1 py-2 font-semibold border-b-2 uppercase tracking-wide transition-all ${
                    activeRouteIndex === idx
                      ? 'border-[#63e7ee] text-[#63e7ee] bg-[#63e7ee]/10'
                      : 'border-transparent text-[#8c9a9c] hover:text-[#edf3f1]'
                  }`}
                >
                  PATH {idx + 1} ({rt.durationText})
                </button>
              ))}
            </div>
          )}

          {/* Primary Route Hero Card */}
          <div className="p-4 bg-[#0a1013]/90 border-t-2 border-[#63e7ee]">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-condensed text-3xl font-bold text-[#63e7ee]">
                  {activeRoute.durationText}
                </span>
                <span className="ml-2 font-mono text-xs text-[#8c9a9c]">
                  ({activeRoute.distanceText})
                </span>
              </div>
              <span className="font-mono text-[9px] border border-[#61dfab]/50 px-2 py-0.5 rounded text-[#61dfab] bg-[#61dfab]/10 uppercase">
                OPTIMAL ROUTE
              </span>
            </div>

            <p className="font-mono text-xs text-[#8c9a9c] mt-1">
              VIA {activeRoute.summary?.toUpperCase()}
            </p>

            {/* Toll / expressway flags */}
            {(activeRoute.hasToll || activeRoute.hasHighway) && (
              <div className="flex items-center flex-wrap gap-1.5 mt-2 font-mono text-[10px]">
                {activeRoute.hasToll && (
                  <span className="flex items-center space-x-1 border border-[#ffbf5c]/40 px-2 py-0.5 rounded text-[#ffbf5c] bg-[#ffbf5c]/10">
                    <IndianRupee className="w-3 h-3" />
                    <span>TOLL ROAD</span>
                  </span>
                )}
                {activeRoute.hasHighway && (
                  <span className="flex items-center space-x-1 border border-[#63e7ee]/40 px-2 py-0.5 rounded text-[#63e7ee] bg-[#63e7ee]/10">
                    <Milestone className="w-3 h-3" />
                    <span>EXPRESSWAY</span>
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setShowSteps(!showSteps)}
              className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded bg-[#172125] border border-[#38474b] font-mono text-xs text-[#edf3f1] hover:border-[#63e7ee] transition-colors"
            >
              <span>{showSteps ? 'HIDE' : 'VIEW'} TURN-BY-TURN STEPS ({activeRoute.steps?.length || 0})</span>
              {showSteps ? <ChevronUp className="w-4 h-4 text-[#63e7ee]" /> : <ChevronDown className="w-4 h-4 text-[#63e7ee]" />}
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
