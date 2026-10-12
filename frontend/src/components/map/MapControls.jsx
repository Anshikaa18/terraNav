import React, { useState } from 'react';
import { useMap } from '../../context/MapContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { Plus, Minus, Navigation, Layers, Sun, Moon } from 'lucide-react';
import { TILE_LAYERS } from '../../utils/constants.js';

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
      alert(err.message || 'Could not retrieve your current location');
    }
  };

  return (
    <div className="absolute right-4 bottom-8 z-[500] flex flex-col items-end space-y-2 pointer-events-auto select-none">
      {/* Layer selector popover */}
      {showLayers && (
        <div className="mb-2 p-2 rounded bg-[#11171b]/98 backdrop-blur-md shadow-[0_12px_36px_rgba(0,0,0,0.7)] border border-[#38484e] w-48 transition-all animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[9px] font-mono font-semibold text-[#63e7ee] px-2 py-1 uppercase tracking-[1.5px] border-b border-[#29353a] mb-1.5">
            MAP STYLE
          </p>
          <div className="space-y-1">
            {Object.values(TILE_LAYERS).map((layer) => (
              <button
                key={layer.id}
                onClick={() => {
                  setActiveLayer(layer.id);
                  setShowLayers(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-mono tracking-wide uppercase transition-colors ${
                  activeLayer === layer.id
                    ? 'bg-[#63e7ee] text-[#090c0f] font-bold shadow-[0_0_8px_rgba(99,231,238,0.4)]'
                    : 'text-[#8c9a9c] hover:bg-[#162024] hover:text-[#edf3f1]'
                }`}
              >
                <span>{layer.name}</span>
                {activeLayer === layer.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#090c0f]"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons Stack */}
      <div className="flex flex-col space-y-1.5 bg-[#11171b]/95 backdrop-blur-md rounded p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-[#29353a]">
        {/* Toggle Layers */}
        <button
          onClick={() => setShowLayers(!showLayers)}
          title="Change map style"
          className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-all"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Theme quick toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Light/Dark Theme"
          className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#ffbf5c]" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="h-px bg-[#29353a] my-0.5 mx-1" />

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-all"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-px bg-[#29353a] my-0.5 mx-1" />

        {/* Current Location button */}
        <button
          onClick={handleLocate}
          disabled={isLocating}
          title="Your current location"
          className={`p-2 rounded border transition-all ${
            isLocating
              ? 'bg-[#63e7ee]/20 text-[#63e7ee] border-[#63e7ee] animate-pulse'
              : 'bg-[#172125] border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee]'
          }`}
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
