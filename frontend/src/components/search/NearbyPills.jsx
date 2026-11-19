import React, { useState } from 'react';
import { useMap } from '../../context/MapContext.jsx';
import { NEARBY_CATEGORIES } from '../../utils/constants.js';
import {
  Utensils,
  Coffee,
  HeartPulse,
  Landmark,
  Bed,
  Fuel,
  GraduationCap,
  Camera,
  Pill,
  Train,
  TrainFront,
  Bus,
  Church,
  ShoppingBag,
  Shield,
  Loader2,
  ChevronDown,
  Plus
} from 'lucide-react';

const ICON_MAP = {
  Utensils,
  Coffee,
  HeartPulse,
  Landmark,
  Bed,
  Fuel,
  GraduationCap,
  Camera,
  Pill,
  Train,
  TrainFront,
  Bus,
  Church,
  ShoppingBag,
  Shield
};

const CATEGORY_COLOR_BADGES = {
  restaurants: { bg: '#ffedd5', text: '#ea580c', border: '#fdba74' },
  cafes: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  hospitals: { bg: '#dc2626', text: '#ffffff', border: '#dc2626' },
  pharmacy: { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
  atms: { bg: '#e0f2fe', text: '#0284c7', border: '#7dd3fc' },
  petrol: { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
  bus: { bg: '#fef9c3', text: '#ca8a04', border: '#fde047' },
  police: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  hotels: { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' },
  temples: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  malls: { bg: '#fae8ff', text: '#c026d3', border: '#f0abfc' },
  colleges: { bg: '#f3e8ff', text: '#9333ea', border: '#d8b4fe' },
  attractions: { bg: '#fce7f3', text: '#db2777', border: '#f9a8d4' },
};

export default function NearbyPills() {
  const { activeCategory, searchNearby, isSearchingNearby } = useMap();
  const [showAll, setShowAll] = useState(false);

  const displayedCategories = showAll ? NEARBY_CATEGORIES : NEARBY_CATEGORIES.slice(0, 8);

  const handleCategoryClick = (catId) => {
    searchNearby(catId);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar select-none">
      {displayedCategories.map((cat) => {
        const IconComponent = ICON_MAP[cat.icon] || Camera;
        const isActive = activeCategory === cat.id;
        const badgeColors = CATEGORY_COLOR_BADGES[cat.id] || { bg: '#e2e8f0', text: '#475569', border: '#cbd5e1' };

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryClick(cat.id)}
            disabled={isSearchingNearby}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 border shadow-xs ${
              isActive
                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-500 ring-1 ring-sky-500/20'
                : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-subtle)] border-[var(--border)]'
            }`}
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: cat.id === 'hospitals' ? '#dc2626' : badgeColors.bg,
                color: cat.id === 'hospitals' ? '#ffffff' : badgeColors.text
              }}
            >
              {isSearchingNearby && isActive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : cat.id === 'hospitals' ? (
                <Plus className="w-3.5 h-3.5 stroke-[3.5]" />
              ) : (
                <IconComponent className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="font-semibold">{cat.label}</span>
          </button>
        );
      })}

      {!showAll && NEARBY_CATEGORIES.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-subtle)] shadow-xs whitespace-nowrap"
        >
          <span className="text-[10px] tracking-widest font-black leading-none">• • •</span>
          <span>More</span>
          <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
        </button>
      )}
    </div>
  );
}
