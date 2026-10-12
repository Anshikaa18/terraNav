import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Navigation,
  Bookmark,
  Share2,
  Phone,
  Globe,
  Clock,
  MapPin,
  Check,
  Accessibility,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useMap } from '../../context/MapContext.jsx';
import { formatCoordinates, formatDistance, getCategoryBadge, calculateHaversineDistanceKm } from '../../utils/geo.js';
import SavePlaceModal from './SavePlaceModal.jsx';

export default function PlaceDetailsPanel({ place = null, onClose = null }) {
  const navigate = useNavigate();
  const { selectedPlace, clearSelection, currentLocation } = useMap();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const activePlace = place || selectedPlace;

  if (!activePlace) return null;

  const handleClose = () => {
    if (onClose) onClose();
    clearSelection();
  };

  const handleDirections = () => {
    navigate(`/directions?to=${activePlace.lat},${activePlace.lon}&toName=${encodeURIComponent(activePlace.name)}`);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/place/${activePlace.id}?lat=${activePlace.lat}&lon=${activePlace.lon}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: activePlace.name,
          text: `Check out ${activePlace.name} on TerraNav`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      alert(`Share link: ${shareUrl}`);
    }
  };

  const handleCopyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${activePlace.lat}, ${activePlace.lon}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  let distText = '';
  if (currentLocation?.lat && currentLocation?.lon && activePlace.lat && activePlace.lon) {
    const km = calculateHaversineDistanceKm(
      currentLocation.lat,
      currentLocation.lon,
      activePlace.lat,
      activePlace.lon
    );
    distText = formatDistance(km);
  }

  const badge = getCategoryBadge(activePlace.category, activePlace.type);

  return (
    <>
      <div className="w-full flex flex-col bg-[#11171b]/98 backdrop-blur-md border border-[#29353a] shadow-[0_16px_40px_rgba(0,0,0,0.7)] h-full overflow-y-auto select-none">
        {/* Header */}
        <div className="p-4 border-b border-[#29353a] bg-[#162024]/60 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <span className="inline-block font-mono text-[9px] border border-[#48585b] px-2 py-0.5 rounded text-[#ffbf5c] bg-[#ffbf5c]/10 mb-1.5 uppercase">
              {badge.name}
            </span>
            <h2 className="font-condensed text-2xl font-bold tracking-wide text-[#edf3f1] truncate">
              {activePlace.name}
            </h2>
            {distText && (
              <p className="font-mono text-xs text-[#63e7ee] mt-0.5">
                {distText} FROM CURRENT POSITION
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#edf3f1] hover:border-[#63e7ee] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-[#29353a] bg-[#0d1215]/80">
          {/* Directions */}
          <button
            onClick={handleDirections}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded font-mono text-[11px] font-bold tracking-wider uppercase text-[#090c0f] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] transition-all shadow-[0_0_10px_rgba(99,231,238,0.25)]"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>ROUTE</span>
          </button>

          {/* Save */}
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded font-mono text-[11px] tracking-wider uppercase text-[#edf3f1] bg-[#172125] hover:border-[#63e7ee] border border-[#38474b] transition-all"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#ffbf5c]" />
            <span>SAVE</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded font-mono text-[11px] tracking-wider uppercase text-[#edf3f1] bg-[#172125] hover:border-[#63e7ee] border border-[#38474b] transition-all"
          >
            {shared ? <Check className="w-3.5 h-3.5 text-[#61dfab]" /> : <Share2 className="w-3.5 h-3.5 text-[#63e7ee]" />}
            <span>{shared ? 'COPIED' : 'SHARE'}</span>
          </button>
        </div>

        {/* Tactical Telemetry Spec Grid */}
        <div className="p-4 space-y-3 font-mono text-xs">
          {/* Coordinates Spec Block */}
          <div className="bg-[#0a1013]/70 border border-[#233035] p-3 rounded">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] text-[#8c9a9c] uppercase tracking-wider">TELEMETRY COORDS</span>
              <button
                onClick={handleCopyCoords}
                title="Copy coordinates"
                className="text-[#63e7ee] hover:text-[#fff] text-[10px] flex items-center space-x-1"
              >
                {copied ? <Check className="w-3 h-3 text-[#61dfab]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <p className="font-mono text-xs text-[#63e7ee] font-semibold">
              {formatCoordinates(activePlace.lat, activePlace.lon)}
            </p>
          </div>

          {/* Address */}
          <div className="bg-[#0a1013]/70 border border-[#233035] p-3 rounded">
            <span className="text-[9px] text-[#8c9a9c] uppercase tracking-wider block mb-1">GEOCODED ADDRESS</span>
            <p className="text-xs text-[#edf3f1] leading-relaxed">
              {activePlace.display_name}
            </p>
          </div>

          {/* Phone (if available) */}
          {activePlace.phone && (
            <div className="bg-[#0a1013]/70 border border-[#233035] p-3 rounded flex items-center justify-between">
              <span className="text-[9px] text-[#8c9a9c] uppercase tracking-wider">CONTACT</span>
              <a
                href={`tel:${activePlace.phone}`}
                className="text-[#63e7ee] hover:underline"
              >
                {activePlace.phone}
              </a>
            </div>
          )}

          {/* Website (if available) */}
          {activePlace.website && (
            <div className="bg-[#0a1013]/70 border border-[#233035] p-3 rounded flex items-center justify-between">
              <span className="text-[9px] text-[#8c9a9c] uppercase tracking-wider">ENDPOINT</span>
              <a
                href={activePlace.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#63e7ee] hover:underline flex items-center space-x-1 truncate max-w-[200px]"
              >
                <span className="truncate">{activePlace.website}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Opening Hours (if available) */}
          {activePlace.opening_hours && (
            <div className="bg-[#0a1013]/70 border border-[#233035] p-3 rounded">
              <span className="text-[9px] text-[#8c9a9c] uppercase tracking-wider block mb-1">SCHEDULE / HOURS</span>
              <p className="text-xs text-[#edf3f1]">
                {activePlace.opening_hours}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      <SavePlaceModal
        place={activePlace}
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
      />
    </>
  );
}
