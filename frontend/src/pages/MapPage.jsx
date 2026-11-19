import React from 'react';
import MapView from '../components/map/MapView.jsx';
import SearchBar from '../components/search/SearchBar.jsx';
import PlaceDetailsPanel from '../components/places/PlaceDetailsPanel.jsx';
import SearchResultsList from '../components/search/SearchResultsList.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';
import { useMap } from '../context/MapContext.jsx';
import TrafficLegend from '../components/map/TrafficLegend.jsx';
import LiveLocationPrompt from '../components/map/LiveLocationPrompt.jsx';

export default function MapPage() {
  const { selectedPlace, clearSelection, searchResults, nearbyResults, activeCategory, nearbyError, isSearchingNearby, routeData, clearNearbyResults, clearSearchResults } = useMap();
  const showingNearby = Boolean(activeCategory);
  const activePlaces = showingNearby ? nearbyResults : searchResults;
  const listTitle = showingNearby ? `Nearby ${activeCategory}` : 'Search Results';

  return (
    <div className="map-page relative w-full h-[calc(100dvh-64px)] flex overflow-hidden">
      {/* Interactive Map Engine */}
      <div className="relative flex-1 h-full w-full">
        <MapView />

        {/* Top Floating Search & Filter Bar */}
        <div className="absolute top-3 left-3 right-3 z-[450] pointer-events-auto md:top-4 md:left-5 md:right-5">
          <SearchBar />
        </div>

        {/* Traffic Conditions Legend shown only when active route exists */}
        {routeData && (
          <div className="absolute bottom-20 left-3 md:bottom-6 md:left-6 z-[400] pointer-events-auto max-w-[calc(100vw-24px)]">
            <TrafficLegend />
          </div>
        )}
      </div>

      {/* Desktop Left-Side Slide-Over Drawer for Place Details */}
      {selectedPlace && (
        <aside className="hidden lg:block absolute top-36 left-5 w-96 max-h-[calc(100%-10rem)] z-[460] rounded-2xl overflow-hidden shadow-float">
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </aside>
      )}

      {/* Desktop Left-Side Results Panel when text search performed */}
      {!selectedPlace && ((showingNearby) || searchResults?.length > 0) && (
        <aside className="hidden lg:block absolute top-36 left-5 w-[420px] max-h-[calc(100%-10rem)] z-[460] rounded-2xl glass-panel shadow-float border border-[var(--border)] overflow-hidden">
          <SearchResultsList places={activePlaces} title={listTitle} loading={showingNearby && isSearchingNearby} error={showingNearby ? nearbyError : null} onClose={showingNearby ? clearNearbyResults : clearSearchResults} />
        </aside>
      )}

      {/* Mobile Bottom Sheets */}
      {selectedPlace && (
        <BottomSheet title={selectedPlace.name} isOpen={true} onClose={clearSelection}>
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </BottomSheet>
      )}

      {!selectedPlace && (showingNearby || searchResults?.length > 0) && (
        <BottomSheet title={listTitle} isOpen={true} onClose={showingNearby ? clearNearbyResults : clearSearchResults}>
          <SearchResultsList places={activePlaces} title={listTitle} loading={showingNearby && isSearchingNearby} error={showingNearby ? nearbyError : null} onClose={showingNearby ? clearNearbyResults : clearSearchResults} />
        </BottomSheet>
      )}
    </div>
  );
}
