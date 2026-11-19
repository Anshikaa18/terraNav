import React, { useState } from 'react';
import { useMap } from '../../context/MapContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Plus, Minus, Navigation, Layers, Sun, Moon, RotateCcw } from 'lucide-react';
import { TILE_LAYERS, DEFAULT_COORDINATES } from '../../utils/constants.js';

export default function MapControls() {
  const { mapInstance, locateUser, isLocating, activeLayer, setActiveLayer } = useMap();
  const { theme, toggleTheme } = useTheme();
  const [showLayers, setShowLayers] = useState(false);

  const handleZoomIn = () => {
    if (mapInstance) mapInstance.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstance) mapInstance.zoomOut();
  };

  const handleLocate = async () => {
    try {
      await locateUser();
    } catch (err) {
      console.warn('Could not retrieve current location:', err.message);
    }
  };

  const handleResetView = () => {
    if (mapInstance) {
      mapInstance.setView([DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon], DEFAULT_COORDINATES.zoom);
    }
  };

  return (
    <div className="absolute right-3 bottom-20 md:right-4 md:bottom-8 z-[450] flex flex-col items-end space-y-2 pointer-events-auto select-none">
      {/* Layer selector popover */}
      {showLayers && (
        <div className="mb-2 p-2.5 rounded-2xl bg-[var(--surface)] backdrop-blur-xl shadow-[var(--shadow-lg)] border border-[var(--border-strong)] w-52 transition-all animate-in fade-in slide-in-from-bottom-2 text-[var(--text)]">
          <p className="text-[10px] font-bold text-[var(--primary)] px-2 py-1 uppercase tracking-wider border-b border-[var(--border)] mb-2">
            Map Style
          </p>
          <div className="space-y-1">
            {Object.values(TILE_LAYERS).map((layer) => (
              <button
                key={layer.id}
                disabled={layer.available === false}
                onClick={() => {
                  if (layer.available === false) return;
                  setActiveLayer(layer.id);
                  setShowLayers(false);
                }}
                title={layer.available === false ? layer.description : undefined}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeLayer === layer.id
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--outline)]/40 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
                }`}
              >
                <span className="min-w-0 truncate">{layer.name}</span>
                {layer.available === false && <span className="text-[9px] font-medium">Key required</span>}
                {activeLayer === layer.id && (
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)]"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons Stack matching Image 2 */}
      <div className="flex flex-col space-y-1 bg-[var(--surface)] rounded-xl p-1 shadow-md border border-[var(--border)]">
        {/* 1. Toggle Layers */}
        <button
          onClick={() => setShowLayers(!showLayers)}
          title="Change map style"
          aria-label="Change map style"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text)] hover:text-sky-600 hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* 2. Reset / History View */}
        <button
          onClick={handleResetView}
          title="Reset to default map view"
          aria-label="Reset map view"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text)] hover:text-sky-600 hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-px bg-[var(--border)] my-0.5 mx-1" />

        {/* 3. Zoom In */}
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text)] hover:text-sky-600 hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* 4. Zoom Out */}
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text)] hover:text-sky-600 hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-px bg-[var(--border)] my-0.5 mx-1" />

        {/* 5. Current Location (GPS) */}
        <button
          onClick={handleLocate}
          disabled={isLocating}
          title="Locate my position"
          aria-label="Locate my position"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text)] hover:text-sky-600 hover:bg-[var(--surface-subtle)] transition-colors disabled:opacity-50"
        >
          <Navigation className={`w-4 h-4 -rotate-45 ${isLocating ? 'animate-pulse text-amber-500' : ''}`} />
        </button>
      </div>
    </div>
  );
}
