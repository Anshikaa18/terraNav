import React from 'react';
import { ArrowUp, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft, Flag, CornerUpRight, RotateCcw } from 'lucide-react';

function getManeuverIcon(type, modifier) {
  const mod = (modifier || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (t === 'arrive') return <Flag className="w-3.5 h-3.5 text-[#ff5d61]" />;
  if (t === 'depart') return <ArrowUp className="w-3.5 h-3.5 text-[#61dfab]" />;
  if (t === 'roundabout') return <RotateCcw className="w-3.5 h-3.5 text-[#63e7ee]" />;

  if (mod.includes('right')) {
    if (mod.includes('slight')) return <ArrowUpRight className="w-3.5 h-3.5 text-[#63e7ee]" />;
    return <CornerUpRight className="w-3.5 h-3.5 text-[#63e7ee]" />;
  }
  if (mod.includes('left')) {
    if (mod.includes('slight')) return <ArrowUpLeft className="w-3.5 h-3.5 text-[#63e7ee]" />;
    return <ArrowLeft className="w-3.5 h-3.5 text-[#63e7ee]" />;
  }

  return <ArrowUp className="w-3.5 h-3.5 text-[#8c9a9c]" />;
}

export default function TurnByTurnList({ steps = [] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="py-2 bg-[#090c0f] select-none">
      <h5 className="font-mono text-[9px] font-semibold uppercase tracking-[1.5px] text-[#63e7ee] px-4 py-1.5 border-b border-[#29353a]">
        WAYPOINT MANEUVERS ({steps.length})
      </h5>
      <div className="divide-y divide-[#29353a]/60">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start space-x-3 px-4 py-2.5 hover:bg-[#162024] transition-colors">
            <div className="mt-0.5 p-1.5 rounded bg-[#172125] border border-[#38474b] text-[#63e7ee] flex-shrink-0">
              {getManeuverIcon(step.type, step.modifier)}
            </div>
            <div className="flex-1 min-w-0 font-mono">
              <p className="text-xs text-[#edf3f1]">
                {step.instruction}
              </p>
              <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-[#8c9a9c]">
                <span className="text-[#63e7ee]">{step.distanceText}</span>
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
