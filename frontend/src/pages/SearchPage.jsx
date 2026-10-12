import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MapView from '../components/map/MapView.jsx';
import SearchBar from '../components/search/SearchBar.jsx';
import SearchResultsList from '../components/search/SearchResultsList.jsx';
import PlaceDetailsPanel from '../components/places/PlaceDetailsPanel.jsx';
import BottomSheet from '../components/layout/BottomSheet.jsx';
import { useMap } from '../context/MapContext.jsx';
import { mapService } from '../services/mapService.js';
import { Loader2 } from 'lucide-react';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [loading, setLoading] = useState(false);

  const { searchResults, setSearchResults, selectPlace, selectedPlace, clearSelection, center } = useMap();

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery) => {
    setLoading(true);
    try {
      const places = await mapService.searchPlaces(searchQuery, center?.[0], center?.[1], 15);
      setSearchResults(places);
      if (places.length > 0 && !selectedPlace) {
        selectPlace(places[0]);
      }
    } catch (err) {
      console.error('Search page query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-62px)] flex overflow-hidden">
      {/* Map View */}
      <div className="relative flex-1 h-full w-full">
        <MapView />

        <div className="absolute top-4 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-[450] pointer-events-auto">
          <SearchBar />
        </div>
      </div>

      {/* Desktop Results Drawer */}
      <aside className="hidden lg:block absolute top-24 left-6 w-[420px] max-h-[calc(100%-7rem)] z-[450] rounded glass-panel shadow-float border border-[#29353a] overflow-y-auto">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center font-mono text-[#63e7ee]">
            <Loader2 className="w-5 h-5 animate-spin mb-2" />
            <p className="text-xs uppercase">SEARCHING TELEMETRY FOR "{query}"...</p>
          </div>
        ) : (
          <SearchResultsList places={searchResults} title={`RESULTS FOR "${query}"`} />
        )}
      </aside>

      {/* Selected place overlay if any */}
      {selectedPlace && (
        <aside className="hidden lg:block absolute top-4 left-[460px] w-96 h-[calc(100%-2rem)] z-[450] rounded overflow-hidden shadow-float">
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </aside>
      )}

      {/* Mobile Bottom Sheets */}
      {selectedPlace ? (
        <BottomSheet title={selectedPlace.name} isOpen={true} onClose={clearSelection}>
          <PlaceDetailsPanel place={selectedPlace} onClose={clearSelection} />
        </BottomSheet>
      ) : (
        <BottomSheet title={`Results for "${query}"`} isOpen={true}>
          <SearchResultsList places={searchResults} title={`Results for "${query}"`} />
        </BottomSheet>
      )}
    </div>
  );
}
