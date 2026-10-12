import React from 'react';
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
  Shield,
};

export default function NearbyPills() {
  const { activeCategory, searchNearby, isSearchingNearby } = useMap();

  const handleCategoryClick = (catId) => {
    searchNearby(catId);
  };

  return (
    <div className="flex items-center space-x-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar select-none">
      {NEARBY_CATEGORIES.map((cat) => {
        const IconComponent = ICON_MAP[cat.icon] || Camera;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            disabled={isSearchingNearby}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-[10px] font-mono tracking-wider uppercase whitespace-nowrap transition-all duration-200 border ${
              isActive
                ? 'bg-[#63e7ee] text-[#071014] font-bold border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.35)]'
                : 'bg-[#11171b]/90 text-[#8c9a9c] hover:text-[#edf3f1] hover:border-[#63e7ee] border-[#29353a]'
            }`}
          >
            {isSearchingNearby && isActive ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <IconComponent className="w-3 h-3" />
            )}
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
