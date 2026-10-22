import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { RequestPage } from './pages/RequestPage';
import { PlayerPage } from './pages/PlayerPage';
import { AdminPage } from './pages/AdminPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/r/:roomCode" element={<RequestPage />} />
      <Route path="/p/:roomCode" element={<PlayerPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
};

export default App;
