import React from 'react';
import { useMap } from '../../context/MapContext.jsx';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { formatDistance, getCategoryBadge } from '../../utils/geo.js';

export default function SearchResultsList({ places = [], title = 'Results' }) {
  const { selectPlace, selectedPlace } = useMap();
  const navigate = useNavigate();

  if (!places || places.length === 0) {
    return (
      <div className="p-8 text-center text-[#8c9a9c] font-mono">
        <MapPin className="w-8 h-8 mx-auto text-[#586769] mb-2 stroke-1" />
        <p className="text-xs uppercase tracking-wider text-[#edf3f1]">NO CHUNKS / PLACES FOUND</p>
        <p className="text-[10px] text-[#8c9a9c] mt-1">
          Adjust coordinates or query terms.
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
    <div className="flex flex-col divide-y divide-[#29353a] bg-[#11171b] select-none">
      <div className="px-4 py-2 bg-[#162024] font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-[#63e7ee] flex justify-between items-center">
        <span>{title}</span>
        <span className="text-[#8c9a9c]">({places.length})</span>
      </div>

      {places.map((place) => {
        const isSelected = selectedPlace?.id === place.id;
        const badge = getCategoryBadge(place.category, place.type);

        return (
          <div
            key={place.id}
            onClick={() => selectPlace(place)}
            className={`p-3.5 cursor-pointer transition-all duration-150 hover:bg-[#162024] ${
              isSelected ? 'bg-[#172327] border-l-2 border-[#63e7ee]' : ''
            }`}
          >
            <div className="flex items-start justify-between space-x-2">
              <div className="flex-1 min-w-0 font-mono">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-semibold text-[#edf3f1] truncate">
                    {place.name}
                  </h4>
                  {place.distanceKm !== undefined && (
                    <span className="text-[10px] font-mono text-[#63e7ee] bg-[#63e7ee]/10 px-1.5 py-0.5 rounded border border-[#63e7ee]/30">
                      {formatDistance(place.distanceKm)}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-[#8c9a9c] line-clamp-2 mt-1 leading-relaxed">
                  {place.display_name}
                </p>

                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-[9px] font-mono border border-[#48585b] px-1.5 py-0.5 text-[#ffbf5c] bg-[#ffbf5c]/10 rounded">
                    {badge.name}
                  </span>
                  {place.address?.city && (
                    <span className="text-[10px] text-[#8c9a9c]">
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
                className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#63e7ee] hover:border-[#63e7ee] hover:bg-[#63e7ee]/10 transition-all flex-shrink-0"
              >
                <Navigation className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
