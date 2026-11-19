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
          text: `Check out ${activePlace.name} on ChunkFlow`,
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
      <div className="w-full flex flex-col bg-[var(--surface-raised)] backdrop-blur-md border border-[var(--border)] shadow-[var(--shadow-lg)] h-full overflow-y-auto select-none rounded-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-subtle)] flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <span className="inline-block text-[10px] font-bold border border-[var(--border-strong)] px-2 py-0.5 rounded-full text-[var(--primary)] bg-[var(--primary-soft)] mb-1.5 uppercase">
              {badge.name}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-[var(--text)] truncate">
              {activePlace.name}
            </h2>
            {distText && (
              <p className="text-xs font-semibold text-[var(--primary)] mt-0.5 font-mono">
                {distText} from current location
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            aria-label="Close place details"
            className="p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--outline)] transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-[var(--border)] bg-[var(--surface)]">
          {/* Directions */}
          <button
            onClick={handleDirections}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] transition-all shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>ROUTE</span>
          </button>

          {/* Save */}
          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wider uppercase text-[var(--text)] bg-[var(--surface-subtle)] hover:border-[var(--outline)] border border-[var(--border)] transition-all"
          >
            <Bookmark className="w-3.5 h-3.5 text-[var(--yellow)]" />
            <span>SAVE</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-semibold tracking-wider uppercase text-[var(--text)] bg-[var(--surface-subtle)] hover:border-[var(--outline)] border border-[var(--border)] transition-all"
          >
            {shared ? <Check className="w-3.5 h-3.5 text-[var(--green)]" /> : <Share2 className="w-3.5 h-3.5 text-[var(--primary)]" />}
            <span>{shared ? 'COPIED' : 'SHARE'}</span>
          </button>
        </div>

        {/* Tactical Telemetry Spec Grid */}
        <div className="p-4 space-y-3 text-xs">
          {/* Coordinates Spec Block */}
          <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-3 rounded-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Coordinates</span>
              <button
                onClick={handleCopyCoords}
                title="Copy coordinates"
                className="text-[var(--primary)] hover:underline text-[10px] font-bold flex items-center space-x-1"
              >
                {copied ? <Check className="w-3 h-3 text-[var(--green)]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <p className="font-mono text-xs text-[var(--text)] font-semibold">
              {formatCoordinates(activePlace.lat, activePlace.lon)}
            </p>
          </div>

          {/* Address */}
          <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-3 rounded-xl">
            <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block mb-1">Address</span>
            <p className="text-xs text-[var(--text)] leading-relaxed font-medium">
              {activePlace.display_name}
            </p>
          </div>

          {/* Phone (if available) */}
          {activePlace.phone && (
            <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-3 rounded-xl flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Phone</span>
              <a
                href={`tel:${activePlace.phone}`}
                className="text-[var(--primary)] font-semibold hover:underline"
              >
                {activePlace.phone}
              </a>
            </div>
          )}

          {/* Website (if available) */}
          {activePlace.website && (
            <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-3 rounded-xl flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Website</span>
              <a
                href={activePlace.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] font-semibold hover:underline flex items-center space-x-1 truncate max-w-[200px]"
              >
                <span className="truncate">{activePlace.website}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}

          {/* Opening Hours (if available) */}
          {activePlace.opening_hours && (
            <div className="bg-[var(--surface-subtle)] border border-[var(--border)] p-3 rounded-xl">
              <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block mb-1">Hours</span>
              <p className="text-xs text-[var(--text)] font-medium">
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
