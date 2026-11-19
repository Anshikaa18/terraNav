import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Navigation, Bookmark, History, Sun, Moon, LogIn, LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useMap } from '../../context/MapContext.jsx';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isSidebarOpen, toggleSidebar } = useMap();
  const location = useLocation();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-IN', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: 'EXPLORE', path: '/', icon: Compass },
    { label: 'DIRECTIONS', path: '/directions', icon: Navigation },
    { label: 'SAVED', path: '/saved', icon: Bookmark },
    { label: 'HISTORY', path: '/history', icon: History },
  ];

  return (
    <header className="h-[64px] w-full bg-[var(--surface)] border-b border-[var(--border)] px-4 md:px-6 flex items-center justify-between z-[400] relative select-none transition-colors duration-200">
      {/* Brand Logo & Hamburger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isSidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
          aria-expanded={isSidebarOpen}
          aria-controls="navigation-sidebar mobile-navigation"
          className="p-1.5 -ml-1 rounded-lg text-[var(--text)] hover:bg-[var(--surface-subtle)] active:scale-95 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex flex-col group">
          <b className="text-lg font-black tracking-tight text-[var(--text)] leading-none">
            ChunkFlow
          </b>
          <small className="text-[9px] tracking-wider font-semibold text-[var(--text-secondary)] uppercase mt-0.5">
            DYNAMIC ROUTING LAB / INDIA
          </small>
        </Link>
      </div>

      {/* Main Nav Links (Desktop) */}
      <nav className="hidden md:flex items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 border border-sky-500 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-[var(--text)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right Telemetry & Actions */}
      <div className="flex items-center gap-3">
        {/* Live Telemetry Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-medium bg-[var(--surface)] border border-[var(--border)] px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-[10px] tracking-wider text-[var(--text)]">LIVE TELEMETRY</span>
          <span className="text-[var(--border)]">|</span>
          <span className="font-mono text-xs font-semibold text-[var(--text)]">{clock || '13:35:43'}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:text-sky-600 hover:border-sky-300 transition-all shadow-xs"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[var(--yellow)]" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Auth Section */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 pl-1 border-l border-[var(--border)]">
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-sky-300 transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline-block max-w-[90px] truncate">{user?.name}</span>
            </Link>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--red)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all"
          >
            <User className="w-3.5 h-3.5" />
            <span>SIGN IN</span>
          </Link>
        )}
      </div>
    </header>
  );
}
