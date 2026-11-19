import React, { useState } from 'react';
import { Navigation, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useMap } from '../../context/MapContext.jsx';

export default function LiveLocationPrompt() {
  const { permissionState, locateUser, isLocating, userLocation, locationError } = useMap();
  const [dismissed, setDismissed] = useState(false);

  // If location is already granted and we have coordinates, no prompt needed
  if (dismissed || userLocation || permissionState === 'granted') {
    return null;
  }

  const handleAllowLocation = async () => {
    try {
      await locateUser();
    } catch (err) {
      // Permission denied or unavailable
    }
  };

  return (
    <div
      className="absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-[440] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="p-3 rounded-lg bg-[#11171b]/98 backdrop-blur-md border border-[#38484e] shadow-[0_12px_36px_rgba(0,0,0,0.7)] flex flex-col space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {permissionState === 'denied' || locationError ? (
              <div className="p-1 rounded bg-[#ff5d61]/20 border border-[#ff5d61]/40 text-[#ff5d61]">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            ) : (
              <div className="p-1 rounded bg-[#63e7ee]/20 border border-[#63e7ee]/40 text-[#63e7ee]">
                <Navigation className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="font-mono text-xs font-semibold tracking-wide text-[#edf3f1] uppercase">
              {permissionState === 'denied' ? 'LOCATION ACCESS BLOCKED' : 'LIVE LOCATION REQUEST'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss location banner"
            className="text-[#8c9a9c] hover:text-[#edf3f1] p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="font-mono text-[11px] text-[#8c9a9c] leading-relaxed">
          {permissionState === 'denied'
            ? 'Browser location is currently blocked. Please allow location permissions in your browser address bar to enable live navigation and real-time traffic speeds.'
            : 'Allow ChunkFlow to access your live GPS position for accurate speed estimates, corridor traffic telemetry, and optimal route guidance.'}
        </p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-1 font-mono text-[10px] text-[#61dfab]">
            <ShieldCheck className="w-3 h-3" />
            <span>GPS data stays local & private</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
              }}
              className="px-2 py-1 rounded font-mono text-[11px] text-[#8c9a9c] hover:text-[#edf3f1]"
            >
              DISMISS
            </button>
            <button
              type="button"
              onClick={handleAllowLocation}
              disabled={isLocating}
              className="px-3 py-1.5 rounded font-mono text-xs font-semibold uppercase tracking-wider bg-[#63e7ee] text-[#090c0f] hover:bg-[#7ef1f7] active:scale-95 transition-all flex items-center space-x-1.5 shadow-[0_0_12px_rgba(99,231,238,0.3)] disabled:opacity-50"
            >
              <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'REQUESTING...' : permissionState === 'denied' ? 'AUTO IP LOCATE' : 'ALLOW LOCATION'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
