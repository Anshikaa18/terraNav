import React, { useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export default function BottomSheet({ children, title = '', isOpen = true, onClose = null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-14 left-0 right-0 z-[440] lg:hidden bg-[var(--surface-raised)] backdrop-blur-xl border-t border-[var(--border)] rounded-t-2xl shadow-[var(--shadow-lg)] transition-all duration-300 ease-in-out flex flex-col ${
        isExpanded ? 'h-[min(84dvh,740px)]' : 'max-h-[55dvh]'
      }`}
    >
      {/* Drag & Expand Handle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full min-h-[44px] flex flex-col items-center pt-2.5 pb-1 cursor-pointer select-none text-left bg-transparent border-0"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--border-strong)] transition-colors hover:bg-[var(--primary)]" />
        <div className="flex items-center justify-between w-full px-4 pt-1.5">
          <span className="text-xs uppercase font-bold text-[var(--primary)] tracking-wide truncate">
            {title}
          </span>
          <span className="text-[var(--text-secondary)] p-0.5" aria-hidden="true">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title || 'panel'}`}
          className="absolute right-3 top-2 min-w-[40px] min-h-[40px] grid place-items-center text-[var(--text-secondary)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-subtle)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Sheet Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
