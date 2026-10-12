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
        address: place.address,
        notes,
        list_id: selectedListId,
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
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in select-none">
        <div className="w-full max-w-sm rounded bg-[#11171b] p-6 shadow-float border border-[#29353a] text-center font-mono">
          <Bookmark className="w-10 h-10 mx-auto text-[#63e7ee] mb-3" />
          <h3 className="font-condensed text-xl font-bold tracking-wide text-[#edf3f1]">
            SIGN IN TO SAVE PLACES
          </h3>
          <p className="text-xs text-[#8c9a9c] mt-2 mb-5">
            Create custom lists for your frequent road chunks, work locations, and waypoints.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded text-xs uppercase font-semibold text-[#8c9a9c] bg-[#172125] border border-[#38474b] hover:border-[#63e7ee]"
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/login');
              }}
              className="flex-1 py-2 rounded text-xs uppercase font-bold text-[#071014] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.25)]"
            >
              SIGN IN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-md rounded bg-[#11171b] p-6 shadow-float border border-[#29353a] font-mono">
        <div className="flex items-center justify-between pb-3 border-b border-[#29353a]">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-4 h-4 text-[#63e7ee]" />
            <h3 className="font-condensed text-xl font-bold tracking-wide text-[#edf3f1]">
              SAVE TO TELEMETRY LISTS
            </h3>
          </div>
          <button onClick={onClose} className="text-[#8c9a9c] hover:text-[#edf3f1]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <p className="text-[10px] text-[#8c9a9c] uppercase tracking-wider">TARGET LOCATION:</p>
          <p className="text-xs font-bold text-[#63e7ee] truncate mt-0.5">
            {place.name}
          </p>
        </div>

        {/* List Picker */}
        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider text-[#8c9a9c] block mb-1.5">
            SELECT A LIST
          </label>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {lists.map((l) => {
              const IconComp = ICON_MAP[l.icon] || Bookmark;
              const isSelected = selectedListId === l.id;

              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedListId(l.id)}
                  type="button"
                  className={`w-full flex items-center justify-between p-2 rounded text-xs uppercase tracking-wide transition-all border ${
                    isSelected
                      ? 'bg-[#63e7ee]/10 text-[#63e7ee] border-[#63e7ee] font-bold'
                      : 'bg-[#172125] text-[#8c9a9c] border-[#38474b] hover:border-[#63e7ee] hover:text-[#edf3f1]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{l.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#63e7ee]" />}
                </button>
              );
            })}
          </div>

          {/* New list trigger */}
          {!isCreatingList ? (
            <button
              type="button"
              onClick={() => setIsCreatingList(true)}
              className="mt-2 flex items-center space-x-1.5 text-[11px] text-[#63e7ee] hover:underline uppercase"
            >
              <Plus className="w-3 h-3" />
              <span>CREATE NEW LIST</span>
            </button>
          ) : (
            <form onSubmit={handleCreateNewList} className="mt-2 flex space-x-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name (e.g. Work spots)"
                className="flex-1 px-2.5 py-1.5 rounded bg-[#172125] border border-[#38474b] text-xs text-[#edf3f1] focus:outline-none focus:border-[#63e7ee]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-[#63e7ee] text-[#071014] text-xs font-bold uppercase tracking-wider"
              >
                ADD
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingList(false)}
                className="px-2 py-1.5 text-xs text-[#8c9a9c] hover:text-[#edf3f1]"
              >
                CANCEL
              </button>
            </form>
          )}
        </div>

        {/* Optional Notes */}
        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider text-[#8c9a9c] block mb-1">
            PERSONAL NOTE (OPTIONAL)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Landmark notes, fast parking, charging point..."
            className="w-full px-2.5 py-1.5 rounded bg-[#172125] border border-[#38474b] text-xs text-[#edf3f1] placeholder-[#586769] focus:outline-none focus:border-[#63e7ee] resize-none"
          />
        </div>

        {error && (
          <div className="mt-2 text-xs text-[#ff5d61]">{error}</div>
        )}

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            type="button"
            className="px-3 py-1.5 rounded text-xs uppercase tracking-wider text-[#8c9a9c] bg-[#172125] border border-[#38474b] hover:border-[#63e7ee]"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedListId}
            type="button"
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-[#071014] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.25)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : success ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
            <span>{success ? 'SAVED!' : 'SAVE LOCATION'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
