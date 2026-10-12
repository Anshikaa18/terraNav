import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Trash2, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { historyService } from '../services/historyService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMap } from '../context/MapContext.jsx';

export default function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const { selectPlace } = useMap();
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
    if (item.latitude && item.longitude) {
      selectPlace({
        id: item.selected_place_id || `hist_${item.id}`,
        name: item.selected_place_name || item.query,
        display_name: item.selected_place_name || item.query,
        lat: Number(item.latitude),
        lon: Number(item.longitude),
      });
      navigate('/');
    } else {
      navigate(`/search?q=${encodeURIComponent(item.query)}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-62px)] flex items-center justify-center p-4 bg-[#090c0f]">
        <div className="w-full max-w-md p-8 rounded bg-[#11171b]/95 border border-[#29353a] shadow-float text-center font-mono">
          <History className="w-10 h-10 mx-auto text-[#63e7ee] mb-4" />
          <h2 className="font-condensed text-2xl font-bold tracking-wide text-[#edf3f1]">
            QUERY LOGS & HISTORY
          </h2>
          <p className="text-xs text-[#8c9a9c] mt-2 mb-6 leading-relaxed">
            Sign in to track your past queries, telemetry lookups, and routing destinations.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider text-[#071014] bg-[#63e7ee] hover:bg-[#7ef1f7] border border-[#63e7ee] shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all"
          >
            SIGN IN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-62px)] flex flex-col max-w-3xl mx-auto p-4 lg:p-8 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="font-mono text-[9px] text-[#63e7ee] tracking-[1.5px] uppercase">QUERY LOGS</span>
          <h1 className="font-condensed text-3xl font-bold tracking-wide text-[#edf3f1]">
            SEARCH & TELEMETRY HISTORY
          </h1>
          <p className="font-mono text-xs text-[#8c9a9c] mt-0.5">
            Recently queried coordinates and searched destinations
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider text-[#ff5d61] bg-[#172125] border border-[#ff5d61]/40 hover:bg-[#ff5d61]/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR ALL</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 font-mono text-[#63e7ee]">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs uppercase">LOADING HISTORY LOGS...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded border border-[#29353a] bg-[#11171b]/60 font-mono">
          <Search className="w-10 h-10 text-[#586769] mb-3" />
          <h3 className="text-sm font-bold text-[#edf3f1] uppercase">
            NO QUERY LOGS FOUND
          </h3>
          <p className="text-xs text-[#8c9a9c] mt-1 max-w-xs leading-relaxed">
            Any addresses, coordinates, or landmarks you search will appear here for fast re-routing.
          </p>
        </div>
      ) : (
        <div className="rounded bg-[#11171b] border border-[#29353a] overflow-hidden divide-y divide-[#29353a] font-mono">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSearchAgain(item)}
              className="p-3.5 flex items-center justify-between hover:bg-[#162024] cursor-pointer transition-colors group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 rounded bg-[#172125] border border-[#38474b] text-[#63e7ee] group-hover:border-[#63e7ee] transition-colors flex-shrink-0">
                  {item.latitude ? <MapPin className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#edf3f1] group-hover:text-[#63e7ee] transition-colors truncate">
                    {item.query}
                  </p>
                  {item.selected_place_name && item.selected_place_name !== item.query && (
                    <p className="text-[10px] text-[#8c9a9c] truncate">
                      {item.selected_place_name}
                    </p>
                  )}
                  <span className="text-[9px] text-[#586769]">
                    {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(e, item.id)}
                  title="Remove from history"
                  className="p-1.5 rounded text-[#8c9a9c] hover:text-[#ff5d61] hover:bg-[#162024] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ArrowRight className="w-3.5 h-3.5 text-[#586769] group-hover:text-[#63e7ee] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
