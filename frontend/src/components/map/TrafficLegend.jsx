import React, { useState } from 'react';
import { Radio, ChevronDown, ChevronUp } from 'lucide-react';

export default function TrafficLegend({ className = '', mode = 'live' }) {
  const [expanded, setExpanded] = useState(false);

  const scales = [
    { key: 'free_flow', label: 'Smooth', color: 'var(--green)' },
    { key: 'moderate', label: 'Moderate', color: 'var(--yellow)' },
    { key: 'heavy', label: 'Heavy', color: 'var(--orange)' },
    { key: 'severe', label: 'Severe', color: 'var(--red)' },
    { key: 'unknown', label: 'No data', color: 'var(--gray)', dashed: true },
  ];

  return (
    <div
      className={`traffic-legend select-none transition-all duration-200 ${
        expanded ? 'w-[360px]' : 'w-auto max-w-[360px]'
      } ${className}`}
      aria-label="Traffic conditions legend"
    >
      <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpanded((prev) => !prev)}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)] tracking-wider">
          <Radio className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>TRAFFIC CONDITIONS</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--outline)]/40 ml-1">
            Segment status
          </span>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse legend' : 'Expand legend details'}
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)]"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Primary Legend Scale Bar */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--border)] overflow-x-auto">
        {scales.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium whitespace-nowrap">
            <i
              aria-hidden="true"
              style={{ backgroundColor: item.color }}
              className={`inline-block w-3.5 h-1.5 rounded-full ${item.dashed ? 'border border-dashed border-[var(--border-strong)]' : ''}`}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-[var(--border)] space-y-1.5 text-[10px] text-[var(--text-secondary)] font-mono">
          <p className="leading-relaxed">
            Routes are divided at provider maneuver or leg boundaries. Segment colors appear only when direction-matched live traffic is available; gray dashed segments have no traffic data.
          </p>
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[9px]">
            <div className="p-1.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)]">
              <span className="text-[var(--text)] font-semibold">Green:</span> free-flow ratio ≥ 80%
            </div>
            <div className="p-1.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)]">
              <span className="text-[var(--text)] font-semibold">Yellow:</span> free-flow ratio 60–79%
            </div>
            <div className="p-1.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)]">
              <span className="text-[var(--text)] font-semibold">Orange:</span> free-flow ratio 40–59%
            </div>
            <div className="p-1.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)]">
              <span className="text-[var(--text)] font-semibold">Red:</span> free-flow ratio &lt; 40%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
