import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Heart, Briefcase, Plane, Trash2, Navigation, MapPin, Loader2, Plus } from 'lucide-react';
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
      address: place.address,
    });
    navigate('/');
  };

  const handleDirections = (place) => {
    navigate(`/directions?to=${place.latitude},${place.longitude}&toName=${encodeURIComponent(place.name)}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[var(--background)]">
        <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)] text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] mb-4 mx-auto border border-[var(--outline)]/40">
            <Bookmark className="w-6 h-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Saved Places & Waypoints
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-2 mb-6 leading-relaxed">
            Sign in to access your bookmarked locations, favorite landmarks, and travel routes across all devices.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] transition-all shadow-sm"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-[var(--text)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:border-[var(--outline)] transition-all"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col max-w-5xl mx-auto p-4 lg:p-8 overflow-y-auto bg-[var(--background)] text-[var(--text)]">
      {/* Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[10px] text-[var(--primary)] font-bold tracking-wider uppercase">Bookmarked Locations</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] mt-0.5">
            Saved Places & Lists
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Manage your bookmarked locations and custom route collections
          </p>
        </div>
      </div>

      {/* List Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 select-none">
        <button
          onClick={() => setSelectedListId(null)}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
            selectedListId === null
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
              : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--outline)] hover:text-[var(--text)]'
          }`}
        >
          All Places
        </button>

        {lists.map((l) => {
          const IconComp = ICON_MAP[l.icon] || Bookmark;
          const isSelected = selectedListId === l.id;

          return (
            <button
              key={l.id}
              onClick={() => setSelectedListId(l.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all border ${
                isSelected
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm font-bold'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--outline)] hover:text-[var(--text)]'
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
        <div className="flex-1 flex items-center justify-center p-12 text-[var(--primary)]">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-semibold uppercase">Loading saved locations...</span>
        </div>
      ) : (selectedListId ? places.filter((place) => (place.collectionName || 'Favorites') === lists.find((list) => list.id === selectedListId)?.name) : places).length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <Bookmark className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
          <h3 className="text-base font-bold text-[var(--text)]">
            No saved places yet
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs leading-relaxed">
            Search for any place, landmark, or coordinates on the map and tap "Save" to bookmark it.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--primary-strong)] transition-all shadow-sm"
          >
            Explore Map
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {places.filter((place) => !selectedListId || (place.collectionName || 'Favorites') === lists.find((list) => list.id === selectedListId)?.name).map((place) => (
            <div
              key={place.id}
              className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--outline)] transition-all flex flex-col justify-between shadow-[var(--shadow-sm)]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-bold text-[var(--text)] truncate pr-2">
                    {place.name}
                  </h3>
                  <button
                    onClick={() => handleDelete(place.id)}
                    title="Remove place"
                    aria-label={`Remove ${place.name}`}
                    className="text-[var(--text-secondary)] hover:text-[var(--red)] transition-colors p-1 rounded-lg hover:bg-[var(--surface-subtle)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                  {place.display_name}
                </p>

                {place.notes && (
                  <div className="mt-2.5 p-2 rounded-lg bg-[var(--primary-soft)] border border-[var(--outline)]/30 text-[var(--primary)] text-xs italic">
                    "{place.notes}"
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <button
                  onClick={() => handleInspect(place)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-[var(--primary)] hover:underline uppercase"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>View on Map</span>
                </button>

                <button
                  onClick={() => handleDirections(place)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary)] hover:text-white transition-all border border-[var(--outline)]/40"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Route</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
