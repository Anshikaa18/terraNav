import React from 'react';
import { NavLink } from 'react-router-dom';
import { Map, Layers, Bookmark, History, Settings } from 'lucide-react';
import { useMap } from '../../context/MapContext.jsx';

const items = [
  { label: 'Map', path: '/', icon: Map },
  { label: 'Layers', path: '#layers', icon: Layers },
  { label: 'Saved', path: '/saved', icon: Bookmark },
  { label: 'History', path: '/history', icon: History },
];

export default function Sidebar() {
  const { activeLayer, setActiveLayer, isSidebarOpen } = useMap();

  const handleLayersClick = (e) => {
    e.preventDefault();
    setActiveLayer((prev) => (prev === 'osm' ? 'light' : prev === 'light' ? 'voyager' : prev === 'voyager' ? 'dark' : 'osm'));
  };

  return (
    <>
      {/* Desktop Vertical Slim Sidebar matching Image 2 */}
      <aside
        id="navigation-sidebar"
        aria-hidden={!isSidebarOpen}
        inert={isSidebarOpen ? undefined : ''}
        className={`hidden lg:flex flex-col items-center justify-between bg-[var(--surface)] z-[400] flex-shrink-0 select-none shadow-xs transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? 'w-16 opacity-100 translate-x-0 border-r border-[var(--border)] py-3'
            : 'w-0 opacity-0 -translate-x-full border-r-0 pointer-events-none overflow-hidden px-0 py-0 m-0'
        }`}
      >
        <div className="flex flex-col items-center space-y-2 w-full px-2">
          {/* 1. Map */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-12 h-13 rounded-xl transition-all duration-150 gap-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] ${
                isActive
                  ? 'relative bg-[var(--primary-soft)] text-[var(--primary)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
              }`
            }
            title="Map"
          >
            <Map className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Map</span>
          </NavLink>

          {/* 2. Layers */}
          <button
            type="button"
            onClick={handleLayersClick}
            className="flex flex-col items-center justify-center w-12 h-13 rounded-xl border-0 bg-transparent shadow-none transition-all duration-150 gap-0.5 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)]"
            title={`Current Layer: ${activeLayer} (Click to switch)`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Layers</span>
          </button>

          {/* 3. Saved */}
          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-12 h-13 rounded-xl transition-all duration-150 gap-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] ${
                isActive
                  ? 'relative bg-[var(--primary-soft)] text-[var(--primary)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
              }`
            }
            title="Saved"
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Saved</span>
          </NavLink>

          {/* 4. History */}
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-12 h-13 rounded-xl transition-all duration-150 gap-0.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] ${
                isActive
                  ? 'relative bg-[var(--primary-soft)] text-[var(--primary)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
              }`
            }
            title="History"
          >
            <History className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">History</span>
          </NavLink>
        </div>

        {/* 5. Settings */}
        <div className="w-full px-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-12 h-13 rounded-xl transition-all duration-150 gap-0.5 text-[10px] font-semibold mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] ${
                isActive
                  ? 'relative bg-[var(--primary-soft)] text-[var(--primary)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
              }`
            }
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar matching Figma tokens */}
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!isSidebarOpen}
        inert={isSidebarOpen ? undefined : ''}
        className={`lg:hidden fixed bottom-0 left-0 right-0 min-h-14 pb-[env(safe-area-inset-bottom)] bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-around z-[450] px-2 shadow-lg transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      >
        {[...items, { label: 'Settings', path: '/settings', icon: Settings }].map((item) => {
          const Icon = item.icon;
          if (item.path === '#layers') {
            return (
              <button
                key={item.path}
                type="button"
                onClick={handleLayersClick}
                className="flex flex-col items-center justify-center flex-1 min-h-[48px] border-0 bg-transparent shadow-none py-1 transition-all rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)]"
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 transition-all rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] ${
                  isActive
                    ? 'text-[var(--primary)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
