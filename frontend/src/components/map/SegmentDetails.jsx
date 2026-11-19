import React from 'react';
import { X, Gauge, Database, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { getTrafficStyle, trafficSourceLabel, formatTrafficTimestamp } from '../../utils/traffic.js';
import { formatDistance } from '../../utils/geo.js';

const formatSpeed = (val) => Number.isFinite(Number(val)) ? `${Math.round(Number(val))} km/h` : 'Unavailable';

export default function SegmentDetails({ segment, onClose }) {
  if (!segment) return null;
  const style = getTrafficStyle(segment);
  const timestamp = segment.observedAt || segment.predictedAt || segment.fetchedAt;
  const source = segment.provider || segment.source || (segment.valueType === 'predicted' ? 'ChunkFlow ML' : 'Telemetry Provider');

  return (
    <aside
      className="fixed lg:absolute top-auto bottom-16 lg:bottom-auto lg:top-4 left-3 right-3 lg:right-auto lg:left-[460px] z-[550] w-auto lg:w-96 max-h-[75vh] overflow-y-auto p-5 rounded-2xl bg-[var(--surface-raised)] backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-lg)] text-[var(--text)] select-none animate-in fade-in slide-in-from-bottom-2"
      role="dialog"
      aria-modal="false"
      aria-label="Road segment traffic details"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[var(--primary)]" />
            <span>ChunkFlow Segment</span>
          </span>
          <h3 className="text-xl font-bold tracking-tight text-[var(--text)] mt-1">
            {segment.roadName || segment.segmentId || 'Road Segment'}
          </h3>
          <span className="text-xs text-[var(--text-secondary)] font-mono">
            Length: {segment.lengthMeters ? formatDistance(segment.lengthMeters / 1000) : `Standard chunk (~${formatDistance(0.35)})`}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close segment details"
          className="p-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--outline)] transition-colors shadow-sm"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Traffic Condition Pill Banner */}
      <div
        className="flex items-center gap-2.5 p-3 rounded-xl mb-4 border"
        style={{
          backgroundColor: 'color-mix(in srgb, ' + style.color + ' 12%, transparent)',
          borderColor: 'color-mix(in srgb, ' + style.color + ' 35%, transparent)',
        }}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 animate-pulse"
          style={{ backgroundColor: style.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-none" style={{ color: style.color }}>
            {style.label} Congestion Level
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
            {trafficSourceLabel(segment)}
          </p>
        </div>
      </div>

      {/* Metric 2x2 Grid matching Figma design */}
      <dl className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <dt className="text-[10px] font-bold uppercase text-[var(--text-secondary)] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-[var(--primary)]" />
            <span>Current Speed</span>
          </dt>
          <dd className="text-sm font-extrabold text-[var(--text)] mt-1 font-mono">
            {formatSpeed(segment.observedSpeedKmh ?? segment.predictedSpeedKmh ?? segment.speedKmh)}
          </dd>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <dt className="text-[10px] font-bold uppercase text-[var(--text-secondary)] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-[var(--green)]" />
            <span>Free-flow Speed</span>
          </dt>
          <dd className="text-sm font-extrabold text-[var(--text)] mt-1 font-mono">
            {formatSpeed(segment.freeFlowSpeedKmh || 45)}
          </dd>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <dt className="text-[10px] font-bold uppercase text-[var(--text-secondary)] flex items-center gap-1">
            <Database className="w-3 h-3 text-[var(--primary)]" />
            <span>Telemetry Source</span>
          </dt>
          <dd className="text-xs font-bold text-[var(--text)] mt-1 truncate">
            {source}
          </dd>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <dt className="text-[10px] font-bold uppercase text-[var(--text-secondary)] flex items-center gap-1">
            <Clock className="w-3 h-3 text-[var(--primary)]" />
            <span>Updated</span>
          </dt>
          <dd className="text-xs font-bold text-[var(--text)] mt-1 truncate font-mono">
            {formatTrafficTimestamp(timestamp)}
          </dd>
        </div>
      </dl>

      {segment.stale && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--yellow)]/10 border border-[var(--yellow)]/30 text-[11px] text-[var(--yellow)] font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Telemetry data is historical or stale; rendered in neutral gray.</span>
        </div>
      )}
    </aside>
  );
}
