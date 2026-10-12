import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Navigation, Bookmark, History, Settings } from 'lucide-react';

export default function Sidebar() {
  const items = [
    { label: 'Explore', path: '/', icon: Compass },
    { label: 'Directions', path: '/directions', icon: Navigation },
    { label: 'Saved', path: '/saved', icon: Bookmark },
    { label: 'History', path: '/history', icon: History },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Vertical Slim Sidebar (Hidden on mobile) */}
      <aside className="hidden lg:flex flex-col items-center justify-between w-14 bg-[#0d1215] border-r border-[#29353a] py-4 z-[400] flex-shrink-0 select-none">
        <div className="flex flex-col items-center space-y-3">
          {items.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-10 h-10 rounded transition-all duration-200 ${
                    isActive
                      ? 'bg-[#63e7ee]/15 text-[#63e7ee] border border-[#63e7ee]/60 shadow-[0_0_12px_rgba(99,231,238,0.25)]'
                      : 'text-[#8c9a9c] hover:bg-[#162024] hover:text-[#edf3f1] border border-transparent'
                  }`
                }
                title={item.label}
              >
                <Icon className="w-4 h-4" />
              </NavLink>
            );
          })}
        </div>

        <div>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center justify-center w-10 h-10 rounded transition-all duration-200 ${
                isActive
                  ? 'bg-[#63e7ee]/15 text-[#63e7ee] border border-[#63e7ee]/60 shadow-[0_0_12px_rgba(99,231,238,0.25)]'
                  : 'text-[#8c9a9c] hover:bg-[#162024] hover:text-[#edf3f1] border border-transparent'
              }`
            }
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </NavLink>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0d1215]/95 backdrop-blur-md border-t border-[#29353a] flex items-center justify-around z-[450] px-2 shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  isActive
                    ? 'text-[#63e7ee] font-semibold'
                    : 'text-[#8c9a9c] hover:text-[#edf3f1]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-mono mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
