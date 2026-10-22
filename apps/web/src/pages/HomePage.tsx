import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc3, Radio, Tv, Shield, ArrowRight, Sparkles } from 'lucide-react';

export const HomePage: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim().toUpperCase();
    if (clean) {
      navigate(`/r/${clean}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16 flex flex-col items-center justify-center text-center">
        {/* Glow Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/30 text-accent-purple text-xs font-semibold mb-8 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Realtime Classroom & Party Jukebox</span>
        </div>

        {/* Big Title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-purple via-accent-blue to-accent-cyan p-0.5 shadow-2xl shadow-accent-purple/30">
            <div className="w-full h-full bg-jukebox-bg rounded-[14px] flex items-center justify-center">
              <Disc3 className="w-9 h-9 text-accent-cyan animate-[spin_10s_linear_infinite]" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            QR MUSIC
          </h1>
        </div>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed">
          ระบบขอเพลงผ่าน QR Code แบบเรียลไทม์ ผู้ร่วมงานหรือนักเรียนสแกนแล้วส่งเพลงได้ทันที
          ไม่ต้องโหลดแอป ไม่ต้องสมัครสมาชิก คิวเพลงซิงก์ขึ้นจอใหญ่ผ่าน WebSocket อัตโนมัติ
        </p>

        {/* Room Code Form */}
        <form
          onSubmit={handleJoin}
          className="w-full max-w-md glass-panel p-2.5 rounded-2xl shadow-2xl border border-white/15 flex flex-col sm:flex-row gap-2 mb-12"
        >
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ใส่รหัสห้อง (เช่น ROOM01)"
            maxLength={10}
            className="flex-1 px-4 py-3.5 rounded-xl glass-input text-white placeholder-slate-500 font-mono text-center sm:text-left text-lg tracking-wider focus:outline-none"
          />
          <button
            type="submit"
            disabled={!roomCode.trim()}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>เข้าห้อง</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div
            onClick={() => roomCode.trim() && navigate(`/r/${roomCode.trim().toUpperCase()}`)}
            className="glass-card p-6 rounded-2xl border border-white/10 hover:border-accent-cyan/40 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-accent-cyan mb-4 group-hover:scale-110 transition-transform">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">หน้าขอเพลง (Request)</h3>
            <p className="text-xs text-slate-400">
              มือถือผู้ร่วมงาน สแกน QR แล้ววางลิงก์ YouTube เพลงจะเข้าคิวทันที
            </p>
          </div>

          <div
            onClick={() => roomCode.trim() && navigate(`/p/${roomCode.trim().toUpperCase()}`)}
            className="glass-card p-6 rounded-2xl border border-white/10 hover:border-accent-purple/40 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple mb-4 group-hover:scale-110 transition-transform">
              <Tv className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">หน้าจอ Player (Stage)</h3>
            <p className="text-xs text-slate-400">
              เปิดฉายขึ้นจอโปรเจกเตอร์หรือทีวี พร้อม QR Code และระบบเล่นต่อเนื่อง
            </p>
          </div>

          <div
            onClick={() => navigate('/admin')}
            className="glass-card p-6 rounded-2xl border border-white/10 hover:border-accent-blue/40 transition-all text-left cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Admin Dashboard</h3>
            <p className="text-xs text-slate-400">
              จัดการห้อง สุ่มรหัสใหม่ จัดลำดับคิว ข้ามเพลง และล้างคิวได้อิสระ
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-500 border-t border-white/5">
        QR Music • Cloudflare Workers + D1 + Durable Objects WebSocket • Dark Jukebox Architecture
      </footer>
    </div>
  );
};
