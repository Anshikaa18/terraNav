import React from 'react';

const LABELS = {
  free_flowing: 'Free flow',
  moderate: 'Moderate',
  heavy: 'Heavy',
  severe: 'Severe',
  unknown: 'Unavailable'
};

function trafficClass(segment) {
  return LABELS[segment?.trafficClass] ? segment.trafficClass : 'unknown';
}

export default function TrafficMeter({ segments = [], status = 'unavailable' }) {
  const visibleSegments = segments.slice(0, 28);
  if (!visibleSegments.length) return null;

  const labels = visibleSegments.map((segment) => LABELS[trafficClass(segment)]).join(', ');
  const sourceLabel = status === 'live' || status === 'cached'
    ? 'Live TomTom traffic'
    : status === 'stale' ? 'Stale traffic not used for ETA' : 'Traffic data unavailable';

  return (
    <section className="traffic-meter" aria-label={`${sourceLabel}. Segment conditions: ${labels}`}>
      <div className="traffic-meter__heading">
        <span className="traffic-meter__title">Route traffic</span>
        <span className="traffic-meter__source">{sourceLabel}</span>
      </div>
      <div className="traffic-meter__track" aria-hidden="true">
        {visibleSegments.map((segment, index) => (
          <span
            key={segment.segmentId || segment.id || index}
            className={`traffic-meter__segment traffic-meter__segment--${trafficClass(segment)}`}
          />
        ))}
      </div>
      {(status === 'live' || status === 'cached') && <div className="traffic-meter__key" aria-hidden="true">
        <span><i className="traffic-meter__dot traffic-meter__dot--free_flowing" />Free</span>
        <span><i className="traffic-meter__dot traffic-meter__dot--moderate" />Moderate</span>
        <span><i className="traffic-meter__dot traffic-meter__dot--heavy" />Heavy</span>
        <span><i className="traffic-meter__dot traffic-meter__dot--severe" />Severe</span>
      </div>}
    </section>
  );
}
