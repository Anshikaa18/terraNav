import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MapView from '../components/map/MapView.jsx';
import PlaceDetailsPanel from '../components/places/PlaceDetailsPanel.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';
import { useMap } from '../context/MapContext.jsx';
import { mapService } from '../services/mapService.js';
import { Loader2 } from 'lucide-react';

export default function PlacePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  const { selectPlace, selectedPlace, clearSelection } = useMap();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadPlace() {
      if (!id && (!lat || !lon)) return;
      setLoading(true);
      try {
        const place = await mapService.getPlaceDetails({
          id,
          lat: lat ? parseFloat(lat) : null,
          lon: lon ? parseFloat(lon) : null,
        });
        if (place) {
          selectPlace(place);
        }
      } catch (err) {
        console.error('Failed to load place by id/coords:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPlace();
  }, [id, lat, lon]);

  return (
    <div className="relative w-full h-[calc(100vh-62px)] flex overflow-hidden">
      {/* Map View */}
      <div className="relative flex-1 h-full w-full">
        <MapView />
      </div>

      {loading && (
        <div className="absolute top-6 left-6 z-[450] p-4 rounded bg-[#11171b]/95 border border-[#29353a] shadow-float flex items-center space-x-2 font-mono text-xs text-[#63e7ee]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>LOADING TELEMETRY DETAILS...</span>
        </div>
      )}

      {/* Desktop Drawer */}
      {selectedPlace && (
        <aside className="hidden lg:block absolute top-4 left-6 w-96 max-h-[calc(100%-2rem)] z-[450] rounded glass-panel shadow-float border border-[#29353a] overflow-hidden">
          <PlaceDetailsPanel place={selectedPlace} onClose={() => navigate('/')} />
        </aside>
      )}

      {/* Mobile Bottom Sheet */}
      {selectedPlace && (
        <BottomSheet title={selectedPlace.name} isOpen={true} onClose={() => navigate('/')}>
          <PlaceDetailsPanel place={selectedPlace} onClose={() => navigate('/')} />
        </BottomSheet>
      )}
    </div>
  );
}
