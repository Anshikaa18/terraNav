import React from 'react';
import { TRANSPORT_MODES } from '../../utils/constants.js';
import { Car, Footprints, Bike } from 'lucide-react';

const ICON_MAP = {
  Car,
  Footprints,
  Bike,
};

export default function TransportSelector({ activeMode, onSelectMode }) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-[#0a1013] border border-[#29353a] rounded select-none">
      {TRANSPORT_MODES.map((mode) => {
        const IconComponent = ICON_MAP[mode.icon] || Car;
        const isActive = activeMode === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelectMode(mode.id)}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded text-[11px] font-mono tracking-wider uppercase transition-all duration-200 border ${
              isActive
                ? 'bg-[#63e7ee] text-[#071014] font-bold border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.3)]'
                : 'bg-[#172125] text-[#8c9a9c] hover:text-[#edf3f1] hover:border-[#63e7ee] border-[#38474b]'
            }`}
          >
            <IconComponent className="w-3.5 h-3.5" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
