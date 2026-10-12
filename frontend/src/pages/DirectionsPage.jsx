import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MapView from '../components/map/MapView.jsx';
import DirectionsPanel from '../components/directions/DirectionsPanel.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';

export default function DirectionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const toCoords = searchParams.get('to') || null;
  const toName = searchParams.get('toName') || '';
  const fromCoords = searchParams.get('from') || null;
  const fromName = searchParams.get('fromName') || '';

  return (
    <div className="relative w-full h-[calc(100vh-62px)] flex overflow-hidden">
      {/* Map View */}
      <div className="relative flex-1 h-full w-full">
        <MapView />
      </div>

      {/* Desktop Directions Left Drawer */}
      <aside className="hidden lg:block absolute top-4 left-6 w-[400px] max-h-[calc(100%-2rem)] z-[450] rounded glass-panel shadow-float border border-[#29353a] overflow-hidden flex flex-col">
        <DirectionsPanel
          initialTo={toCoords}
          initialToName={toName}
          initialFrom={fromCoords}
          initialFromName={fromName}
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
            onClose={() => navigate('/')}
          />
        </BottomSheet>
      </div>
    </div>
  );
}
