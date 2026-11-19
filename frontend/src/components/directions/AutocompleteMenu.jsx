import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Navigation } from 'lucide-react';

export default function AutocompleteMenu({ anchorRef, side, places, loading, error, onSelect, onUseCurrentLocation }) {
  const [position, setPosition] = useState(null);
  const [activeOptionId, setActiveOptionId] = useState(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 8;
      const availableBelow = window.innerHeight - rect.bottom - gap - 12;
      const availableAbove = rect.top - gap - 12;
      const openAbove = availableBelow < 170 && availableAbove > availableBelow;
      const maxHeight = Math.max(120, Math.min(280, openAbove ? availableAbove : availableBelow));
      setPosition({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap })
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  if (!position) return null;
  return createPortal(
    <div
      className="rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] overflow-y-auto divide-y divide-[var(--border)]"
      style={{ position: 'fixed', zIndex: 10000, ...position }}
      onMouseDown={(event) => event.preventDefault()}
      role="listbox"
      aria-label={`${side === 'from' ? 'Origin' : 'Destination'} suggestions`}
    >
      {onUseCurrentLocation && (
        <button
          type="button"
          onClick={onUseCurrentLocation}
          className="w-full min-h-10 flex items-center gap-2 border-0 bg-transparent px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:bg-[var(--primary-soft)]"
        >
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Use current location</span>
        </button>
      )}
      {loading && <p className="px-3 py-3 text-xs text-[var(--text-secondary)]">Searching locations…</p>}
      {!loading && error && <p role="alert" className="px-3 py-3 text-xs text-[var(--red)]">{error}</p>}
      {!loading && !error && places.length === 0 && (
        <p className="px-3 py-3 text-xs text-[var(--text-secondary)]">No matching places found.</p>
      )}
      {!loading && !error && places.map((place) => (
        <button
          key={place.id}
          type="button"
          role="option"
          aria-selected={activeOptionId === place.id}
          onClick={() => onSelect(place)}
          onMouseEnter={() => setActiveOptionId(place.id)}
          onFocus={() => setActiveOptionId(place.id)}
          className={`w-full min-h-10 flex items-center gap-2 border-0 bg-transparent px-3 py-2 text-left transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:bg-[var(--primary-soft)] ${activeOptionId === place.id ? 'bg-[var(--primary-soft)]/60' : ''}`}
        >
          <MapPin className={`w-3.5 h-3.5 ${side === 'from' ? 'text-[var(--primary)]' : 'text-[var(--red)]'} flex-shrink-0`} aria-hidden="true" />
          <span className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-[var(--text)] truncate">{place.name}</span>
            <span className="text-[11px] leading-snug text-[var(--text-secondary)] truncate">{place.displayName || place.display_name || 'Address unavailable'}</span>
          </span>
        </button>
      ))}
    </div>,
    document.body
  );
}
