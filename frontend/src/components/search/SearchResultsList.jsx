import React from 'react';
import { useMap } from '../../context/MapContext.jsx';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, X } from 'lucide-react';
import { calculateHaversineDistanceKm, formatDistance, getCategoryBadge } from '../../utils/geo.js';

export default function SearchResultsList({ places = [], title = 'Results', loading = false, error = null, onClose = null }) {
  const { selectPlace, selectedPlace, center } = useMap();
  const navigate = useNavigate();

  if (!places || places.length === 0) {
    return (
      <div className="relative p-8 text-center text-[var(--text-secondary)]">
        {onClose && <button type="button" onClick={onClose} aria-label="Close nearby results" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>}
        <MapPin className="w-8 h-8 mx-auto text-[var(--text-tertiary)] mb-2 stroke-1" />
        <p className="text-xs uppercase font-bold tracking-wider text-[var(--text)]">
          {loading ? 'Searching nearby places…' : error ? 'Places are unavailable' : 'No places found'}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1" role={error ? 'alert' : undefined}>
          {error || (loading ? 'Searching TomTom places around the map center.' : 'Try another category or move the map to a different area.')}
        </p>
      </div>
    );
  }

  const handleDirections = (e, place) => {
    e.stopPropagation();
    selectPlace(place);
    navigate(`/directions?to=${place.lat},${place.lon}&toName=${encodeURIComponent(place.name)}`);
  };

  return (
    <div className="flex max-h-[min(42dvh,380px)] flex-col divide-y divide-[var(--border)] bg-[var(--surface)] select-none lg:max-h-[min(65dvh,640px)]">
      <div className="sticky top-0 z-10 shrink-0 px-4 py-2.5 bg-[var(--surface-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] flex justify-between items-center border-b border-[var(--border)]">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-secondary)] font-mono">({places.length})</span>
          {onClose && <button type="button" onClick={onClose} aria-label="Close nearby results" className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
        {places.map((place) => {
          const isSelected = selectedPlace?.id === place.id;
          const badge = getCategoryBadge(place.category, place.type);
          const placeDistanceKm = place.distanceKm ?? calculateHaversineDistanceKm(center, undefined, place);
          const address = typeof place.address === 'string'
            ? place.address
            : (place.display_name || Object.values(place.address || {}).filter(Boolean).join(', '));

          return (
            <div
              key={place.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => selectPlace(place)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectPlace(place);
                }
              }}
              className={`p-3.5 cursor-pointer transition-all duration-150 hover:bg-[var(--surface-subtle)] ${
                isSelected ? 'bg-[var(--primary-soft)] border-l-4 border-[var(--primary)]' : ''
              }`}
            >
              <div className="flex items-start justify-between space-x-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-bold text-[var(--text)] truncate">
                    {place.name || 'Unnamed place'}
                    </h4>
                    {Number.isFinite(placeDistanceKm) && placeDistanceKm > 0 && (
                      <span className="text-[10px] font-mono font-semibold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded border border-[var(--outline)]/30">
                        {formatDistance(placeDistanceKm)}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                    {address || 'Address unavailable'}
                  </p>

                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-[9px] font-bold border border-[var(--border)] px-1.5 py-0.5 text-[var(--text)] bg-[var(--surface-subtle)] rounded-md">
                      {badge.name}
                    </span>
                    {place.address?.city && (
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {place.address.city}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Directions Button */}
                <button
                  type="button"
                  onClick={(e) => handleDirections(e, place)}
                  title="Get Directions"
                  aria-label={`Directions to ${place.name}`}
                  className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)] hover:border-[var(--outline)] hover:bg-[var(--primary-soft)] transition-all flex-shrink-0 shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
