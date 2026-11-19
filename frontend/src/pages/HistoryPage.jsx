import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Trash2, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { historyService } from '../services/historyService.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const items = await historyService.getHistory();
      setHistory(items);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear your entire search history?')) return;
    try {
      await historyService.clearHistory();
      setHistory([]);
    } catch (err) {
      alert('Failed to clear history');
    }
  };

  const handleDeleteItem = async (e, id) => {
    e.stopPropagation();
    try {
      await historyService.deleteHistoryItem(id);
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  const handleSearchAgain = (item) => {
    const { origin, destination } = item;
    if (!origin || !destination || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lon) || !Number.isFinite(destination.lat) || !Number.isFinite(destination.lon)) return;
    const params = new URLSearchParams({
      from: `${origin.lat},${origin.lon}`,
      fromName: origin.name || `${origin.lat}, ${origin.lon}`,
      to: `${destination.lat},${destination.lon}`,
      toName: destination.name || `${destination.lat}, ${destination.lon}`,
      mode: item.mode === 'car' ? 'driving' : (item.mode || 'driving')
    });
    navigate(`/directions?${params.toString()}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[var(--background)]">
        <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)] text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] mb-4 mx-auto border border-[var(--outline)]/40">
            <History className="w-6 h-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Query Logs & History
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-2 mb-6 leading-relaxed">
            Sign in to track your past searches, telemetry lookups, and recent routing destinations.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] transition-all shadow-sm"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col max-w-3xl mx-auto p-4 lg:p-8 overflow-y-auto bg-[var(--background)] text-[var(--text)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-[var(--primary)] font-bold tracking-wider uppercase">Query Logs</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)] mt-0.5">
            Search History
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Recently queried coordinates and searched destinations
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[var(--red)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--red)]/10 transition-colors shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 text-[var(--primary)]">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-semibold uppercase">Loading history logs...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <Search className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
          <h3 className="text-base font-bold text-[var(--text)]">
            No query logs found
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs leading-relaxed">
            Any addresses, coordinates, or landmarks you search will appear here for quick access.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)] shadow-[var(--shadow-sm)]">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSearchAgain(item)}
              className="p-3.5 flex items-center justify-between hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--primary)] group-hover:border-[var(--outline)] transition-colors flex-shrink-0">
                  {item.origin && item.destination ? <MapPin className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors truncate">
                    {item.query}
                  </p>
                  {item.selected_place_name && item.selected_place_name !== item.query && (
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {item.selected_place_name}
                    </p>
                  )}
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                    {item.timestamp ? `${new Date(item.timestamp).toLocaleDateString()} at ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Date unavailable'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(e, item.id)}
                  title="Remove from history"
                  aria-label="Remove item"
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--red)] hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
