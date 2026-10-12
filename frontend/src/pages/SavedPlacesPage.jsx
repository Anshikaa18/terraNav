import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Heart, Briefcase, Plane, Trash2, Navigation, MapPin, Loader2 } from 'lucide-react';
import { savedPlaceService } from '../services/savedPlaceService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMap } from '../context/MapContext.jsx';

const ICON_MAP = {
  heart: Heart,
  briefcase: Briefcase,
  plane: Plane,
  bookmark: Bookmark,
};

export default function SavedPlacesPage() {
  const { isAuthenticated, user } = useAuth();
  const { selectPlace } = useMap();
  const navigate = useNavigate();

  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, selectedListId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedLists, fetchedPlaces] = await Promise.all([
        savedPlaceService.getSavedLists(),
        savedPlaceService.getSavedPlaces(selectedListId),
      ]);
      setLists(fetchedLists);
      setPlaces(fetchedPlaces);
    } catch (err) {
      console.error('Failed to load saved data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this place?')) return;
    try {
      await savedPlaceService.deleteSavedPlace(id);
      setPlaces(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert('Failed to delete place: ' + err.message);
    }
  };

  const handleInspect = (place) => {
    selectPlace({
      id: place.place_id,
      name: place.name,
      display_name: place.display_name,
      lat: Number(place.latitude),
      lon: Number(place.longitude),
      category: place.category,
      address: place.address_json,
    });
    navigate('/');
  };

  const handleDirections = (place) => {
    navigate(`/directions?to=${place.latitude},${place.longitude}&toName=${encodeURIComponent(place.name)}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-62px)] flex items-center justify-center p-4 bg-[#090c0f]">
        <div className="w-full max-w-md p-8 rounded bg-[#11171b]/95 border border-[#29353a] shadow-float text-center font-mono">
          <Bookmark className="w-10 h-10 mx-auto text-[#63e7ee] mb-4" />
          <h2 className="font-condensed text-2xl font-bold tracking-wide text-[#edf3f1]">
            SAVED PLACES & WAYPOINTS
          </h2>
          <p className="text-xs text-[#8c9a9c] mt-2 mb-6 leading-relaxed">
            Sign in to access your persistent road chunks, favorite Indian landmarks, and travel itineraries across sessions.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider text-[#071014] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all"
            >
              SIGN IN
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 py-2.5 rounded font-mono text-xs font-semibold uppercase tracking-wider text-[#edf3f1] bg-[#172125] border border-[#38474b] hover:border-[#63e7ee] transition-all"
            >
              REGISTER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-62px)] flex flex-col max-w-5xl mx-auto p-4 lg:p-8 overflow-y-auto">
      {/* Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="font-mono text-[9px] text-[#63e7ee] tracking-[1.5px] uppercase">BOOKMARKED TELEMETRY</span>
          <h1 className="font-condensed text-3xl font-bold tracking-wide text-[#edf3f1]">
            SAVED PLACES & LISTS
          </h1>
          <p className="font-mono text-xs text-[#8c9a9c] mt-0.5">
            Manage your bookmarked locations and custom route collections
          </p>
        </div>
      </div>

      {/* List Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-4 select-none font-mono">
        <button
          onClick={() => setSelectedListId(null)}
          className={`px-4 py-2 rounded text-xs uppercase tracking-wider transition-all border ${
            selectedListId === null
              ? 'bg-[#63e7ee] text-[#071014] font-bold border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.3)]'
              : 'bg-[#11171b] text-[#8c9a9c] border-[#29353a] hover:border-[#63e7ee] hover:text-[#edf3f1]'
          }`}
        >
          ALL PLACES
        </button>

        {lists.map((l) => {
          const IconComp = ICON_MAP[l.icon] || Bookmark;
          const isSelected = selectedListId === l.id;

          return (
            <button
              key={l.id}
              onClick={() => setSelectedListId(l.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded text-xs uppercase tracking-wider transition-all border ${
                isSelected
                  ? 'bg-[#63e7ee] text-[#071014] font-bold border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.3)]'
                  : 'bg-[#11171b] text-[#8c9a9c] border-[#29353a] hover:border-[#63e7ee] hover:text-[#edf3f1]'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{l.name}</span>
            </button>
          );
        })}
      </div>

      {/* Content State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 font-mono text-[#63e7ee]">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs uppercase">LOADING SAVED LOCATIONS...</span>
        </div>
      ) : places.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded border border-[#29353a] bg-[#11171b]/60 font-mono">
          <Bookmark className="w-10 h-10 text-[#586769] mb-3" />
          <h3 className="text-sm font-bold text-[#edf3f1] uppercase">
            NO SAVED PLACES YET
          </h3>
          <p className="text-xs text-[#8c9a9c] mt-1 max-w-xs leading-relaxed">
            Search for any road chunk, station, or landmark and click "Save" to build your telemetry index.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded bg-[#63e7ee] text-[#071014] text-xs font-bold uppercase tracking-wider hover:bg-[#7ef1f7] transition-all shadow-[0_0_10px_rgba(99,231,238,0.25)]"
          >
            EXPLORE MAP
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {places.map((place) => (
            <div
              key={place.id}
              className="p-4 rounded bg-[#11171b] border border-[#29353a] hover:border-[#63e7ee]/60 transition-all flex flex-col justify-between font-mono"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-xs font-bold text-[#edf3f1] truncate pr-2">
                    {place.name}
                  </h3>
                  <button
                    onClick={() => handleDelete(place.id)}
                    title="Remove place"
                    className="text-[#8c9a9c] hover:text-[#ff5d61] transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[10px] text-[#8c9a9c] line-clamp-2 mt-1 leading-relaxed">
                  {place.display_name}
                </p>

                {place.notes && (
                  <div className="mt-2.5 p-2 rounded bg-[#ffbf5c]/10 border border-[#ffbf5c]/30 text-[#ffbf5c] text-[10px] italic">
                    "{place.notes}"
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-4 pt-3 border-t border-[#29353a] flex items-center justify-between">
                <button
                  onClick={() => handleInspect(place)}
                  className="flex items-center space-x-1.5 text-xs text-[#63e7ee] hover:underline uppercase"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>VIEW ON MAP</span>
                </button>

                <button
                  onClick={() => handleDirections(place)}
                  className="p-1.5 rounded bg-[#172125] border border-[#38474b] text-[#63e7ee] hover:border-[#63e7ee] hover:bg-[#63e7ee]/10 transition-colors"
                  title="Get Directions"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
