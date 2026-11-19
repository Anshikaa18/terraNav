import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight, MapPin, Navigation } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce.js';
import { mapService } from '../../services/mapService.js';
import { useMap } from '../../context/MapContext.jsx';
import { formatDistance } from '../../utils/geo.js';
import NearbyPills from './NearbyPills.jsx';

export default function SearchBar({ onSearchSubmit = null }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const { selectPlace, setSearchResults, clearNearbyResults, center, userLocation, selectedPlace } = useMap();

  useEffect(() => {
    let isCancelled = false;

    async function fetchSuggestions() {
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
        setSuggestions([]);
        setSearchError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSearchError(null);
      try {
        const targetLat = selectedPlace?.lat ?? userLocation?.lat ?? center?.[0] ?? null;
        const targetLng = selectedPlace?.lon ?? selectedPlace?.lng ?? userLocation?.lng ?? center?.[1] ?? null;
        const places = await mapService.searchPlaces(
          debouncedQuery,
          targetLat,
          targetLng,
          8
        );
        if (!isCancelled) {
          setSuggestions(places);
          setIsOpen(true);
        }
      } catch (err) {
        if (!isCancelled) {
          setSuggestions([]);
          setSearchError(err.message || 'Location search is temporarily unavailable.');
          setIsOpen(true);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, center, userLocation, selectedPlace]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (place) => {
    clearNearbyResults();
    setQuery(place.name || place.display_name?.split(',')[0] || '');
    setIsOpen(false);
    selectPlace(place);
    setSearchResults([place]);
    if (onSearchSubmit) onSearchSubmit(place);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    try {
      const targetLat = selectedPlace?.lat ?? userLocation?.lat ?? center?.[0] ?? null;
      const targetLng = selectedPlace?.lon ?? selectedPlace?.lng ?? userLocation?.lng ?? center?.[1] ?? null;
      const places = await mapService.searchPlaces(query, targetLat, targetLng, 10);
      clearNearbyResults();
      setSearchResults(places);
      setIsOpen(false);

      if (places.length > 0) {
        selectPlace(places[0]);
      }
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    } catch (err) {
      console.error('Search submit failed:', err);
      setSearchError(err.message || 'Location search is temporarily unavailable.');
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setSearchError(null);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleFormSubmit}
        className="relative flex items-center w-full h-11 md:h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs transition-all duration-200 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/20"
      >
        <div className="pl-3.5 pr-2.5 text-sky-600">
          <Search className="w-4 h-4 md:w-5 md:h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || searchError) setIsOpen(true);
          }}
          placeholder="Search coordinates / places (e.g. MG Road, Raipur)"
          className="w-full h-full bg-transparent pr-3 text-xs md:text-sm font-medium text-[var(--text)] placeholder:text-slate-400 focus:outline-none"
        />

        {/* Clear or Loading Indicator */}
        <div className="flex items-center space-x-1.5 pr-1.5">
          {isLoading && <Loader2 className="w-4 h-4 text-sky-600 animate-spin mr-1" />}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="border-0 bg-transparent p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Bright Blue Navigation Action Button matching Image 2 */}
          <button
            type="submit"
            title="Search / Directions"
            aria-label="Search or get directions"
            className="w-8 h-8 md:w-9 md:h-9 border-0 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all flex-shrink-0"
          >
            <Navigation className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || searchError || (query.trim().length >= 2 && !isLoading)) && (
        <div className="absolute top-14 left-0 right-0 z-[600] rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] py-2 max-h-80 overflow-y-auto">
          <p className="px-4 py-1 text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider border-b border-[var(--border)] mb-1">
            Matching Locations
          </p>
          {searchError && <p className="px-4 py-3 text-xs text-[var(--red)]" role="alert">{searchError}</p>}
          {!searchError && suggestions.length === 0 && !isLoading && <p className="px-4 py-3 text-xs text-[var(--text-secondary)]">No matching places found.</p>}
          {suggestions.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full flex items-start space-x-3 px-4 py-2.5 hover:bg-[var(--surface-subtle)] transition-colors text-left group border-b border-[var(--border)]/40 last:border-0"
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors truncate">
                    {item.name || item.display_name?.split(',')[0]}
                  </span>
                  {item.distanceKm != null && (
                    <span className="text-[10px] font-mono font-semibold text-[var(--primary)] ml-2 flex-shrink-0 bg-[var(--primary-soft)] px-1.5 py-0.5 rounded">
                      {formatDistance(item.distanceKm)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                  {item.display_name}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity self-center flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Nearby Quick Filters */}
      <div className="mt-2">
        <NearbyPills />
      </div>
    </div>
  );
}
