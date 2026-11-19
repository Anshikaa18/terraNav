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
    window.dispatchEvent(new Event('terranav_settings_changed'));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col max-w-3xl mx-auto p-4 lg:p-8 overflow-y-auto select-none bg-[var(--background)] text-[var(--text)]">
      <div className="mb-6">
        <span className="text-[10px] text-[var(--primary)] font-bold tracking-wider uppercase">Preferences</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] flex items-center space-x-2.5 mt-0.5">
          <Settings className="w-6 h-6 text-[var(--primary)]" />
          <span>Application Settings</span>
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Customize your map appearance, navigation defaults, and display parameters
        </p>
      </div>

      <div className="space-y-5 pb-12">
        {/* User Account Card */}
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Account Profile</span>
          </h2>

          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-[var(--primary-soft)] border border-[var(--outline)]/40 text-[var(--primary)] flex items-center justify-center font-bold text-base shadow-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    {user?.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-[var(--red)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:bg-[var(--red)]/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-secondary)]">
                Browsing as guest. Sign in to synchronize saved waypoints and routing telemetry.
              </p>
              <a
                href="/login"
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--primary-strong)] transition-all flex-shrink-0 ml-4 shadow-sm"
              >
                Sign In
              </a>
            </div>
          )}
        </div>

        {/* Display & Theme */}
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Sun className="w-4 h-4" />
            <span>Theme & Appearance</span>
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark Mode', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor },
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
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-xs font-semibold tracking-wide transition-all ${
                    isSelected
                      ? 'border-[var(--outline)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm font-bold'
                      : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--outline)]'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1.5" />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Map Layer */}
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Map className="w-4 h-4" />
            <span>Default Basemap Layer</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.values(TILE_LAYERS).map((layer) => {
              const isSelected = activeLayer === layer.id;

              return (
                <button
                  key={layer.id}
                  disabled={layer.available === false}
                  onClick={() => setActiveLayer(layer.id)}
                  title={layer.available === false ? layer.description : undefined}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? 'border-[var(--outline)] bg-[var(--primary-soft)] text-[var(--primary)] font-bold shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--outline)] hover:text-[var(--text)]'
                  }`}
                >
                  <span>{layer.name}{layer.available === false ? ' · Key required' : ''}</span>
                  {isSelected && <Check className="w-4 h-4 text-[var(--primary)]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation & Units */}
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <h2 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Compass className="w-4 h-4" />
            <span>Navigation Defaults</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-1.5">
                Distance Metric
              </label>
              <div className="flex space-x-2.5">
                {[
                  { id: 'km', label: 'Kilometers (km)' },
                  { id: 'm', label: 'Meters (m)' },
                ].map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUnits(u.id);
                      localStorage.setItem('terranav_units', u.id);
                      window.dispatchEvent(new Event('terranav_settings_changed'));
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide border transition-all ${
                      units === u.id
                        ? 'border-[var(--outline)] bg-[var(--primary-soft)] text-[var(--primary)] font-bold shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--outline)] hover:text-[var(--text)]'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-1.5">
                Preferred Travel Mode
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TRANSPORT_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPreferredMode(m.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold tracking-wide border transition-all ${
                      preferredMode === m.id
                        ? 'border-[var(--outline)] bg-[var(--primary-soft)] text-[var(--primary)] font-bold shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--outline)] hover:text-[var(--text)]'
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
                className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-sm"
              >
                {savedSuccess ? <Check className="w-4 h-4" /> : null}
                <span>{savedSuccess ? 'Preferences Saved!' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* System & Architecture Info */}
        <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1.5 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-[var(--primary)]">
            <ShieldCheck className="w-4 h-4" />
            <span>ChunkFlow Dynamic Routing Lab</span>
          </div>
          <p className="leading-relaxed">
            ChunkFlow ML Neural Predictions • CartoDB Positron & Dark Matter Tiles • TomTom Places & Traffic • Real-time Traffic Corridors.
          </p>
        </div>
      </div>
    </div>
  );
}
