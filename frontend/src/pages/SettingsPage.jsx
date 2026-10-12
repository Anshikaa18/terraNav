import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useMap } from '../context/MapContext.jsx';
import { TILE_LAYERS, TRANSPORT_MODES } from '../utils/constants.js';
import { Settings, User, Moon, Sun, Monitor, Map, Compass, ShieldCheck, LogOut, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { activeLayer, setActiveLayer } = useMap();

  const [units, setUnits] = useState(() => localStorage.getItem('terranav_units') || 'km');
  const [preferredMode, setPreferredMode] = useState(() => localStorage.getItem('terranav_preferred_mode') || 'driving');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('terranav_units', units);
    localStorage.setItem('terranav_preferred_mode', preferredMode);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-62px)] flex flex-col max-w-3xl mx-auto p-4 lg:p-8 overflow-y-auto select-none font-mono">
      <div className="mb-6">
        <span className="text-[9px] text-[#63e7ee] tracking-[1.5px] uppercase">CONFIGURATION CONSOLE</span>
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-[#edf3f1] flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[#63e7ee]" />
          <span>APPLICATION SETTINGS</span>
        </h1>
        <p className="text-xs text-[#8c9a9c] mt-0.5">
          Customize your map telemetry, routing preferences, and visual layer parameters
        </p>
      </div>

      <div className="space-y-5">
        {/* User Account Card */}
        <div className="p-5 rounded bg-[#11171b] border border-[#29353a] shadow-sm">
          <h2 className="text-xs font-bold text-[#63e7ee] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <User className="w-3.5 h-3.5" />
            <span>AUTHENTICATION PROFILE</span>
          </h2>

          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded bg-[#172125] border border-[#63e7ee] text-[#63e7ee] flex items-center justify-center font-bold text-base shadow-[0_0_8px_rgba(99,231,238,0.25)]">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#edf3f1]">
                    {user?.name}
                  </h3>
                  <p className="text-[10px] text-[#8c9a9c]">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider text-[#ff5d61] bg-[#172125] border border-[#ff5d61]/40 hover:bg-[#ff5d61]/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>SIGN OUT</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#8c9a9c]">
                Browsing as guest. Sign in to synchronize saved waypoints and routing telemetry.
              </p>
              <a
                href="/login"
                className="px-3.5 py-1.5 rounded bg-[#63e7ee] text-[#071014] text-xs font-bold uppercase tracking-wider hover:bg-[#7ef1f7] transition-all flex-shrink-0 ml-4 shadow-[0_0_10px_rgba(99,231,238,0.2)]"
              >
                SIGN IN
              </a>
            </div>
          )}
        </div>

        {/* Display & Theme */}
        <div className="p-5 rounded bg-[#11171b] border border-[#29353a] shadow-sm">
          <h2 className="text-xs font-bold text-[#63e7ee] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Sun className="w-3.5 h-3.5" />
            <span>THEME & DISPLAY MODE</span>
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', label: 'LIGHT', icon: Sun },
              { id: 'dark', label: 'DARK COMMAND', icon: Moon },
              { id: 'system', label: 'SYSTEM', icon: Monitor },
            ].map((th) => {
              const Icon = th.icon;
              const isSelected = theme === th.id;

              return (
                <button
                  key={th.id}
                  onClick={() => {
                    if (th.id === 'system') {
                      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      setTheme(sysDark ? 'dark' : 'light');
                    } else {
                      setTheme(th.id);
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded border text-xs tracking-wider uppercase transition-all ${
                    isSelected
                      ? 'border-[#63e7ee] bg-[#63e7ee]/10 text-[#63e7ee] shadow-[0_0_8px_rgba(99,231,238,0.2)] font-bold'
                      : 'border-[#38474b] bg-[#172125] text-[#8c9a9c] hover:text-[#edf3f1] hover:border-[#63e7ee]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1.5" />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Map Layer */}
        <div className="p-5 rounded bg-[#11171b] border border-[#29353a] shadow-sm">
          <h2 className="text-xs font-bold text-[#63e7ee] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Map className="w-3.5 h-3.5" />
            <span>DEFAULT BASEMAP LAYER</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.values(TILE_LAYERS).map((layer) => {
              const isSelected = activeLayer === layer.id;

              return (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`flex items-center justify-between p-3 rounded border text-xs tracking-wider uppercase transition-all ${
                    isSelected
                      ? 'border-[#63e7ee] bg-[#63e7ee]/10 text-[#63e7ee] font-bold shadow-[0_0_8px_rgba(99,231,238,0.2)]'
                      : 'border-[#38474b] bg-[#172125] text-[#8c9a9c] hover:border-[#63e7ee] hover:text-[#edf3f1]'
                  }`}
                >
                  <span>{layer.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#63e7ee]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation & Units */}
        <div className="p-5 rounded bg-[#11171b] border border-[#29353a] shadow-sm">
          <h2 className="text-xs font-bold text-[#63e7ee] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Compass className="w-3.5 h-3.5" />
            <span>NAVIGATION & DISTANCE UNITS</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c9a9c] mb-1.5">
                DISTANCE METRIC
              </label>
              <div className="flex space-x-2.5">
                {[
                  { id: 'km', label: 'KILOMETERS (KM / M)' },
                  { id: 'miles', label: 'MILES (MI / FT)' },
                ].map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUnits(u.id)}
                    className={`flex-1 py-2 px-3 rounded text-xs tracking-wider uppercase border transition-all ${
                      units === u.id
                        ? 'border-[#63e7ee] bg-[#63e7ee]/10 text-[#63e7ee] font-bold shadow-[0_0_8px_rgba(99,231,238,0.2)]'
                        : 'border-[#38474b] bg-[#172125] text-[#8c9a9c] hover:border-[#63e7ee] hover:text-[#edf3f1]'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#8c9a9c] mb-1.5">
                DEFAULT TRAVEL MODE
              </label>
              <div className="flex space-x-2.5">
                {TRANSPORT_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPreferredMode(m.id)}
                    className={`flex-1 py-2 px-3 rounded text-xs tracking-wider uppercase border transition-all ${
                      preferredMode === m.id
                        ? 'border-[#63e7ee] bg-[#63e7ee]/10 text-[#63e7ee] font-bold shadow-[0_0_8px_rgba(99,231,238,0.2)]'
                        : 'border-[#38474b] bg-[#172125] text-[#8c9a9c] hover:border-[#63e7ee] hover:text-[#edf3f1]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2.5 rounded bg-[#63e7ee] hover:bg-[#7ef1f7] text-[#071014] text-xs font-bold uppercase tracking-wider border border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all flex items-center space-x-2"
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{savedSuccess ? 'PREFERENCES SAVED!' : 'SAVE PREFERENCES'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* System & Architecture Info */}
        <div className="p-4 rounded bg-[#0a1013] border border-[#233035] text-[11px] text-[#8c9a9c] space-y-1.5">
          <div className="flex items-center space-x-2 font-semibold text-[#61dfab]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>TERRANAV / CHUNKFLOW ARCHITECTURE</span>
          </div>
          <p>
            Vercel Serverless Functions API • OpenStreetMap & CartoDB Dark Matter Tiles • Valhalla Routing Engine • India-Biased Geocoding.
          </p>
          <p className="text-[10px] text-[#586769]">
            ChunkFlow Cyber Command Palette • Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
