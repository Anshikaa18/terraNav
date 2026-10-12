import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function BottomSheet({ children, title = '', isOpen = true, onClose = null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-14 left-0 right-0 z-[440] lg:hidden bg-[#11171b] border-t border-[#29353a] rounded-t-xl shadow-float transition-all duration-300 ease-in-out flex flex-col ${
        isExpanded ? 'h-[80vh]' : 'max-h-[45vh]'
      }`}
    >
      {/* Drag & Expand Handle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex flex-col items-center pt-2.5 pb-1 cursor-pointer select-none"
      >
        <div className="w-10 h-1 rounded-full bg-[#38484e]" />
        <div className="flex items-center justify-between w-full px-4 pt-1 font-mono">
          <span className="text-[10px] uppercase font-semibold text-[#63e7ee] truncate">
            {title}
          </span>
          <button className="text-[#8c9a9c] p-0.5">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sheet Content */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {children}
      </div>
    </div>
  );
}
