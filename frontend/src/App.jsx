import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';

import MapPage from './pages/MapPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import DirectionsPage from './pages/DirectionsPage.jsx';
import PlacePage from './pages/PlacePage.jsx';
import SavedPlacesPage from './pages/SavedPlacesPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-[var(--background)] text-[var(--text)]">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Workspace with Sidebar and View */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 relative overflow-hidden transition-all duration-300 ease-in-out">
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/directions" element={<DirectionsPage />} />
            <Route path="/place/:id" element={<PlacePage />} />
            <Route path="/saved" element={<SavedPlacesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
