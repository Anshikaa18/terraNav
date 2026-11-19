import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MapView from '../components/map/MapView.jsx';
import DirectionsPanel from '../components/directions/DirectionsPanel.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';
import TrafficLegend from '../components/map/TrafficLegend.jsx';
import LiveLocationPrompt from '../components/map/LiveLocationPrompt.jsx';

export default function DirectionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const toCoords = searchParams.get('to') || null;
  const toName = searchParams.get('toName') || '';
  const fromCoords = searchParams.get('from') || null;
  const fromName = searchParams.get('fromName') || '';
  const mode = searchParams.get('mode') || 'driving';

  return (
    <div className="map-page directions-map-page relative w-full h-[calc(100dvh-64px)] flex overflow-hidden">
      {/* Map View */}
      <div className="relative flex-1 h-full w-full">
        <MapView />
        <div className="absolute top-3 right-3 md:top-4 md:right-20 z-[400] pointer-events-auto">
          <TrafficLegend />
        </div>
        <LiveLocationPrompt />
      </div>

      {/* Desktop Directions Left Drawer */}
      <aside className="hidden lg:block absolute top-4 left-6 w-[410px] h-fit max-h-[calc(100dvh-2rem)] z-[450] overflow-visible flex flex-col">
        <DirectionsPanel
          initialTo={toCoords}
          initialToName={toName}
          initialFrom={fromCoords}
          initialFromName={fromName}
          initialMode={mode}
          onClose={() => navigate('/')}
        />
      </aside>

      {/* Mobile Bottom Sheet for Directions */}
      <div className="lg:hidden">
        <BottomSheet title="Route & Directions" isOpen={true} onClose={() => navigate('/')}>
          <DirectionsPanel
            initialTo={toCoords}
            initialToName={toName}
            initialFrom={fromCoords}
            initialFromName={fromName}
            initialMode={mode}
            onClose={() => navigate('/')}
          />
        </BottomSheet>
      </div>
    </div>
  );
}
