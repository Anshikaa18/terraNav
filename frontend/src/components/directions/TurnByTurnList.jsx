import React from 'react';
import { ArrowUp, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft, Flag, CornerUpRight, RotateCcw } from 'lucide-react';
import { distanceText } from '../../services/directionService.js';

function getManeuverIcon(type, modifier) {
  const mod = (modifier || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (t === 'arrive') return <Flag className="w-3.5 h-3.5 text-[var(--red)]" />;
  if (t === 'depart') return <ArrowUp className="w-3.5 h-3.5 text-[var(--green)]" />;
  if (t === 'roundabout') return <RotateCcw className="w-3.5 h-3.5 text-[var(--primary)]" />;

  if (mod.includes('right')) {
    if (mod.includes('slight')) return <ArrowUpRight className="w-3.5 h-3.5 text-[var(--primary)]" />;
    return <CornerUpRight className="w-3.5 h-3.5 text-[var(--primary)]" />;
  }
  if (mod.includes('left')) {
    if (mod.includes('slight')) return <ArrowUpLeft className="w-3.5 h-3.5 text-[var(--primary)]" />;
    return <ArrowLeft className="w-3.5 h-3.5 text-[var(--primary)]" />;
  }

  return <ArrowUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
}

export default function TurnByTurnList({ steps = [] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="py-2 bg-[var(--surface)] select-none">
      <h5 className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        WAYPOINT MANEUVERS ({steps.length})
      </h5>
      <div className="divide-y divide-[var(--border)] max-h-[min(42dvh,420px)] overflow-y-scroll overscroll-contain">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start space-x-3 px-4 py-2.5 hover:bg-[var(--surface-subtle)] transition-colors">
            <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--primary)] flex-shrink-0">
              {getManeuverIcon(step.type, step.modifier)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text)]">
                {step.instruction}
              </p>
              <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-[var(--text-secondary)] font-mono">
                <span className="text-[var(--primary)] font-semibold">{step.distanceText || (typeof step.distance === 'number' ? distanceText(step.distance) : step.distance)}</span>
                {step.name && step.name !== 'Unnamed road' && (
                  <>
                    <span>•</span>
                    <span className="truncate">{step.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
