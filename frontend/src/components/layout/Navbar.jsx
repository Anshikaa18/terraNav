import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Navigation, Bookmark, History, Sun, Moon, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    { label: 'Explore', path: '/', icon: Compass },
    { label: 'Directions', path: '/directions', icon: Navigation },
    { label: 'Saved', path: '/saved', icon: Bookmark },
    { label: 'History', path: '/history', icon: History },
  ];

  return (
    <header className="h-[62px] w-full bg-[#0d1215]/95 backdrop-blur-md border-b border-[#29353a] px-4 md:px-6 flex items-center justify-between z-[400] relative select-none">
      {/* Brand Logo & Eyebrow */}
      <Link to="/" className="flex items-center gap-3 group">
        <span className="text-[#63e7ee] text-2xl font-mono leading-none drop-shadow-[0_0_10px_#63e7ee]">
          ◫
        </span>
        <div className="flex flex-col">
          <b className="font-condensed text-xl font-bold tracking-[2px] text-[#63e7ee] leading-none">
            TERRANAV
          </b>
          <small className="font-mono text-[9px] tracking-[1.5px] text-[#8c9a9c] mt-0.5 uppercase block">
            DYNAMIC ROUTING LAB / INDIA
          </small>
        </div>
      </Link>

      {/* Main Nav Links (Desktop) */}
      <nav className="hidden md:flex items-center space-x-1.5 font-mono text-[11px] tracking-wider uppercase">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded transition-all duration-200 ${
                isActive
                  ? 'bg-[#63e7ee]/10 text-[#63e7ee] border border-[#63e7ee]/50 shadow-[0_0_10px_rgba(99,231,238,0.2)]'
                  : 'text-[#8c9a9c] hover:text-[#edf3f1] hover:bg-[#162024] border border-transparent'
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
        <div className="hidden lg:flex items-center gap-2 text-[#adb9b8] font-mono text-[11px] bg-[#11171b] border border-[#29353a] px-3 py-1 rounded">
          <span className="pulse" aria-hidden="true"></span>
          <span className="tracking-wider">LIVE TELEMETRY</span>
          <span className="text-[#586769]">•</span>
          <span className="text-[#63e7ee] font-semibold">{clock || '--:--:--'}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle light/dark theme"
          className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#63e7ee] hover:border-[#63e7ee] transition-all"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-[#ffbf5c]" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* User Auth Section */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-2 pl-2 border-l border-[#29353a]">
            <Link
              to="/settings"
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-[#172125] border border-[#38474b] text-[11px] font-mono text-[#edf3f1] hover:border-[#63e7ee] transition-colors"
            >
              <div className="w-4 h-4 rounded-full bg-[#63e7ee] text-[#090c0f] flex items-center justify-center text-[9px] font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline-block max-w-[90px] truncate">{user?.name}</span>
            </Link>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded bg-[#172125] border border-[#38474b] text-[#8c9a9c] hover:text-[#ff5d61] hover:border-[#ff5d61] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase text-[#071014] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] transition-all shadow-[0_0_10px_rgba(99,231,238,0.25)]"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
