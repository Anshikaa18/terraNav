import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight, MapPin, Navigation } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce.js';
import { mapService } from '../../services/mapService.js';
import { useMap } from '../../context/MapContext.jsx';
import NearbyPills from './NearbyPills.jsx';

export default function SearchBar({ onSearchSubmit = null }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const { selectPlace, setSearchResults, center } = useMap();

  useEffect(() => {
    let isCancelled = false;

    async function fetchSuggestions() {
      if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const places = await mapService.searchPlaces(
          debouncedQuery,
          center?.[0] || null,
          center?.[1] || null,
          6
        );
        if (!isCancelled) {
          setSuggestions(places);
          setIsOpen(true);
        }
      } catch (err) {
        if (!isCancelled) setSuggestions([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, center]);

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
    setQuery(place.name || place.display_name.split(',')[0]);
    setIsOpen(false);
    selectPlace(place);
    setSearchResults([place]);
    if (onSearchSubmit) onSearchSubmit(place);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const places = await mapService.searchPlaces(query, center?.[0], center?.[1], 10);
      setSearchResults(places);
      setIsOpen(false);

      if (places.length > 0) {
        selectPlace(places[0]);
      }
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    } catch (err) {
      console.error('Search submit failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <form
        onSubmit={handleFormSubmit}
        className="relative flex items-center w-full h-11 rounded bg-[#11171b]/95 backdrop-blur-md border border-[#29353a] transition-all duration-200 focus-within:border-[#63e7ee] focus-within:shadow-[0_0_12px_rgba(99,231,238,0.25)]"
      >
        <div className="pl-3.5 pr-2 text-[#63e7ee]">
          <Search className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder="SEARCH COORDINATES / PLACES (MG ROAD, KORAMANGALA...)"
          className="w-full h-full bg-transparent pr-10 font-mono text-xs text-[#edf3f1] placeholder-[#586769] focus:outline-none uppercase tracking-wide"
        />

        {/* Clear or Loading Indicator */}
        <div className="flex items-center space-x-1 pr-2">
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-[#63e7ee] animate-spin mr-1" />}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-[#8c9a9c] hover:text-[#edf3f1] hover:bg-[#162024] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-4 w-px bg-[#29353a] mx-1" />

          {/* Quick directions action button */}
          <button
            type="button"
            onClick={() => navigate('/directions')}
            title="Directions"
            className="p-1.5 rounded text-[#63e7ee] hover:bg-[#63e7ee]/10 hover:shadow-[0_0_8px_rgba(99,231,238,0.3)] transition-all"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-13 left-0 right-0 z-[600] rounded bg-[#11171b]/98 backdrop-blur-md border border-[#38484e] shadow-[0_12px_36px_rgba(0,0,0,0.7)] py-2 max-h-80 overflow-y-auto">
          <p className="px-4 py-1 text-[9px] font-mono font-semibold text-[#63e7ee] uppercase tracking-[1.5px] border-b border-[#29353a] mb-1">
            MATCHING LOCATIONS
          </p>
          {suggestions.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full flex items-start space-x-3 px-4 py-2 hover:bg-[#162024] transition-colors text-left group border-b border-[#29353a]/40 last:border-0"
            >
              <div className="mt-0.5 p-1 rounded bg-[#172125] text-[#63e7ee] group-hover:bg-[#63e7ee] group-hover:text-[#090c0f] transition-colors">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0 font-mono">
                <div className="text-xs font-semibold text-[#edf3f1] group-hover:text-[#63e7ee] transition-colors truncate">
                  {item.name}
                </div>
                <div className="text-[10px] text-[#8c9a9c] truncate">
                  {item.display_name}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#63e7ee] opacity-0 group-hover:opacity-100 transition-opacity self-center" />
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
