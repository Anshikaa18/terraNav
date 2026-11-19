import React, { useState, useEffect } from 'react';
import { X, Bookmark, Plus, Loader2, Check, Heart, Briefcase, Plane } from 'lucide-react';
import { savedPlaceService } from '../../services/savedPlaceService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const ICON_MAP = {
  heart: Heart,
  briefcase: Briefcase,
  plane: Plane,
  bookmark: Bookmark,
};

export default function SavePlaceModal({ place, isOpen, onClose, onSaved = null }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [notes, setNotes] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadLists();
    }
  }, [isOpen, isAuthenticated]);

  const loadLists = async () => {
    setLoading(true);
    try {
      const userLists = await savedPlaceService.getSavedLists();
      setLists(userLists);
      if (userLists.length > 0) {
        setSelectedListId(userLists[0].id);
      }
    } catch (err) {
      console.error('Failed to load lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const created = await savedPlaceService.createSavedList(newListName.trim(), 'bookmark');
      if (created) {
        setLists(prev => [...prev, created]);
        setSelectedListId(created.id);
        setNewListName('');
        setIsCreatingList(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to create list');
    }
  };

  const handleSave = async () => {
    if (!place) return;
    setSaving(true);
    setError(null);

    try {
      await savedPlaceService.savePlace({
        place_id: place.id,
        name: place.name,
        display_name: place.display_name,
        category: place.category,
        latitude: place.lat,
        longitude: place.lon,
        address: place.address || place.display_name,
        notes,
        collectionName: lists.find((list) => String(list.id) === String(selectedListId))?.name || 'Favorites',
      });

      setSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to save place');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in select-none">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)] border border-[var(--border)] text-center">
          <Bookmark className="w-10 h-10 mx-auto text-[var(--primary)] mb-3" />
          <h3 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Sign In to Save Places
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-2 mb-5">
            Create custom lists for your frequent places, commute waypoints, and favorite landmarks.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs uppercase font-semibold text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:border-[var(--outline)]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/login');
              }}
              className="flex-1 py-2.5 rounded-xl text-xs uppercase font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)] border border-[var(--border)] text-[var(--text)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Bookmark className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold tracking-tight text-[var(--text)]">
              Save Location
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--text-secondary)] hover:text-[var(--text)] p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Location:</p>
          <p className="text-sm font-bold text-[var(--primary)] truncate mt-0.5">
            {place.name}
          </p>
        </div>

        {/* List Picker */}
        <div className="mt-4">
          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] block mb-1.5">
            Select Collection
          </label>
          <div className="grid gap-1.5 max-h-36 overflow-y-auto">
            {lists.map((l) => {
              const IconComp = ICON_MAP[l.icon] || Bookmark;
              const isSelected = selectedListId === l.id;

              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedListId(l.id)}
                  type="button"
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                    isSelected
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--outline)] font-bold'
                      : 'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <IconComp className="w-4 h-4" />
                    <span>{l.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[var(--primary)]" />}
                </button>
              );
            })}
          </div>

          {/* New list trigger */}
          {!isCreatingList ? (
            <button
              type="button"
              onClick={() => setIsCreatingList(true)}
              className="mt-2.5 flex items-center space-x-1.5 text-xs text-[var(--primary)] font-bold hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New List</span>
            </button>
          ) : (
            <form onSubmit={handleCreateNewList} className="mt-2.5 flex space-x-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name (e.g. Work spots)"
                className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--outline)]"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold uppercase tracking-wider"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingList(false)}
                className="px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Optional Notes */}
        <div className="mt-4">
          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] block mb-1">
            Personal Note (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Parking instructions, gate number..."
            className="w-full px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--outline)] resize-none"
          />
        </div>

        {error && (
          <div className="mt-2 text-xs text-[var(--red)]">{error}</div>
        )}

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-xl text-xs uppercase tracking-wider text-[var(--text-secondary)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:border-[var(--outline)] font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedListId}
            type="button"
            className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] disabled:opacity-50 shadow-sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : success ? (
              <Check className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span>{success ? 'Saved!' : 'Save Location'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
