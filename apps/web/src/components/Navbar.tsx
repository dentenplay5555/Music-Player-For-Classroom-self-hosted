import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Disc3, Radio, Tv, Shield, Home } from 'lucide-react';

interface NavbarProps {
  roomCode?: string;
  roomName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ roomCode, roomName }) => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 flex items-center justify-between">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-purple to-accent-cyan p-0.5 shadow-lg shadow-accent-purple/20 group-hover:scale-105 transition-transform">
          <div className="w-full h-full bg-jukebox-bg rounded-[10px] flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-accent-cyan animate-[spin_8s_linear_infinite]" />
          </div>
        </div>
        <div>
          <span className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            QR MUSIC
          </span>
          <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
            Jukebox
          </span>
        </div>
      </Link>

      {/* Center Room Badge if in room context */}
      {roomCode && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-jukebox-surface/80 border border-white/10 text-xs">
          <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <span className="text-slate-400 font-normal">ห้อง:</span>
          <span className="font-bold text-white tracking-wide">{roomName || roomCode}</span>
          <span className="text-slate-500 font-mono">({roomCode})</span>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex items-center gap-2">
        <Link
          to="/"
          className={`p-2 rounded-lg text-xs font-medium transition-colors ${
            location.pathname === '/'
              ? 'bg-accent-purple/20 text-white border border-accent-purple/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          title="หน้าแรก"
        >
          <Home className="w-4 h-4" />
        </Link>

        {roomCode && (
          <>
            <Link
              to={`/r/${roomCode}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                location.pathname.startsWith('/r/')
                  ? 'bg-accent-purple/20 text-white border border-accent-purple/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-accent-cyan" />
              <span className="hidden sm:inline">ขอเพลง</span>
            </Link>

            <Link
              to={`/p/${roomCode}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                location.pathname.startsWith('/p/')
                  ? 'bg-accent-purple/20 text-white border border-accent-purple/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-accent-purple" />
              <span className="hidden sm:inline">จอ Player</span>
            </Link>
          </>
        )}

        <Link
          to="/admin"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            location.pathname.startsWith('/admin')
              ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      </nav>
    </header>
  );
};
