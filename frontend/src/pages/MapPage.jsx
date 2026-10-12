import React from 'react';
import MapView from '../components/map/MapView.jsx';
import SearchBar from '../components/search/SearchBar.jsx';
import PlaceDetailsPanel from '../components/places/PlaceDetailsPanel.jsx';
import SearchResultsList from '../components/search/SearchResultsList.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';
import { useMap } from '../context/MapContext.jsx';

export default function MapPage() {
  const { selectedPlace, clearSelection, searchResults, nearbyResults, activeCategory } = useMap();

  const hasResults = (searchResults && searchResults.length > 0) || (nearbyResults && nearbyResults.length > 0);
  const activePlaces = nearbyResults.length > 0 ? nearbyResults : searchResults;
  const listTitle = nearbyResults.length > 0 ? `Nearby ${activeCategory || 'Places'}` : 'Search Results';

  return (
    <div className="relative w-full h-[calc(100vh-62px)] flex overflow-hidden">
      {/* Interactive Map Engine */}
      <div className="relative flex-1 h-full w-full">
        <MapView />

        {/* Top Floating Search & Filter Bar */}
        <div className="absolute top-4 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-[450] pointer-events-auto">
          <SearchBar />
        </div>

        {/* ChunkFlow Legend Overlay */}
        <div className="legend hidden md:flex absolute top-4 right-20 z-[400] bg-[#0d1215]/92 border border-[#29353a] px-3 py-1.5 rounded shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
          <span><i className="g" aria-hidden="true"></i>FREE</span>
          <span><i className="y" aria-hidden="true"></i>FLOWING</span>
          <span><i className="o" aria-hidden="true"></i>SLOW</span>
          <span><i className="r" aria-hidden="true"></i>SEVERE</span>
        </div>

        {/* Bottom Telemetry Guide */}
        <div className="map-key hidden sm:block pointer-events-none">
          CLICK A CHUNK / PIN TO INSPECT TELEMETRY METRICS
        </div>
      </div>

      {/* Desktop Left-Side Slide-Over Drawer for Place Details */}
      {selectedPlace && (
        <aside className="hidden lg:block absolute top-4 left-[460px] w-96 h-[calc(100%-2rem)] z-[450] rounded overflow-hidden shadow-float">
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </aside>
      )}

      {/* Desktop Left-Side Results Panel when places found */}
      {!selectedPlace && hasResults && (
        <aside className="hidden lg:block absolute top-24 left-6 w-[420px] max-h-[calc(100%-7rem)] z-[450] rounded glass-panel shadow-float border border-[#29353a] overflow-y-auto">
          <SearchResultsList places={activePlaces} title={listTitle} />
        </aside>
      )}

      {/* Mobile Bottom Sheets */}
      {selectedPlace && (
        <BottomSheet title={selectedPlace.name} isOpen={true} onClose={clearSelection}>
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </BottomSheet>
      )}

      {!selectedPlace && hasResults && (
        <BottomSheet title={listTitle} isOpen={true}>
          <SearchResultsList places={activePlaces} title={listTitle} />
        </BottomSheet>
      )}
    </div>
  );
}
