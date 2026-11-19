import React from 'react';
import { TRANSPORT_MODES } from '../../utils/constants.js';
import { Car, Footprints, Bike } from 'lucide-react';

function MotorcycleIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="16" r="3" />
      <circle cx="19" cy="16" r="3" />
      <path d="M5 16h2l3-6 4 1 2 5h3" />
      <path d="M12 11l-2-4h3l2 2" />
      <path d="M17 9l1-3h2" />
    </svg>
  );
}

const ICON_MAP = {
  Car,
  Footprints,
  Bike,
  Bicycle: Bike,
  Motorcycle: MotorcycleIcon,
};

export default function TransportSelector({ activeMode, onSelectMode }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl select-none w-full">
      {TRANSPORT_MODES.map((mode) => {
        const IconComponent = ICON_MAP[mode.icon] || Car;
        const isActive = activeMode === mode.id || (activeMode === 'bike' && mode.id === 'motorcycle');

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelectMode(mode.id)}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 border min-h-[38px] ${
              isActive
                ? 'bg-[var(--surface)] text-[var(--primary)] border-[var(--outline)] shadow-sm font-bold'
                : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)]/60 border-transparent'
            }`}
          >
            <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
