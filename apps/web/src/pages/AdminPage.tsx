import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { api, ApiError, connectRoomWebSocket } from '../api/client';
import {
  AdminRoomItem,
  AdminRoomDetail,
  DashboardStats,
  RoomSettings,
} from '@qr-music/shared';
import {
  Shield,
  Plus,
  RefreshCw,
  Trash2,
  SkipForward,
  Play,
  Pause,
  Lock,
  Unlock,
  Radio,
  Tv,
  AlertTriangle,
  RotateCcw,
  Check,
  LogOut,
  ListMusic,
  ArrowLeft,
  Settings,
  Activity,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Users,
  Music,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('qr_music_admin_token'));
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // View state: 'dashboard' | 'room'
  const [currentView, setCurrentView] = useState<'dashboard' | 'room'>('dashboard');
  const [activeTab, setActiveTab] = useState<'queue' | 'player' | 'settings' | 'logs'>('queue');

  // Dashboard Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rooms, setRooms] = useState<AdminRoomItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomDetail, setRoomDetail] = useState<AdminRoomDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals & Inputs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<RoomSettings>({
    maxQueue: 100,
    allowDuplicates: false,
    cooldownSeconds: 5,
  });
  const [editRoomName, setEditRoomName] = useState('');

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // 1. Fetch Dashboard Stats & Rooms
  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setStats(res.stats);
      setRooms(res.rooms);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        setIsAuthenticated(false);
        api.adminLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Detailed Room Data
  const loadRoomDetail = async (roomId: string) => {
    try {
      setLoading(true);
      const detail = await api.getRoomDetails(roomId);
      setRoomDetail(detail);
      setSettingsForm(detail.settings);
      setEditRoomName(detail.room.name);
    } catch (err) {
      console.error('Failed to load room details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
      const interval = setInterval(() => {
        loadDashboard();
      }, 10000); // Polling dashboard every 10s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && selectedRoomId && currentView === 'room') {
      loadRoomDetail(selectedRoomId);

      const room = rooms.find((r) => r.id === selectedRoomId);
      if (room) {
        // Connect WebSocket for real-time room updates in Admin
        const cleanup = connectRoomWebSocket(room.code, (msg) => {
          if (
            msg.type === 'queue.updated' ||
            msg.type === 'song.added' ||
            msg.type === 'song.started' ||
            msg.type === 'song.skipped' ||
            msg.type === 'player.status'
          ) {
            loadRoomDetail(selectedRoomId);
          }
        });
        return cleanup;
      }
    }
  }, [isAuthenticated, selectedRoomId, currentView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await api.adminLogin(password);
      setIsAuthenticated(true);
      setPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setLoginError(err.message);
      } else {
        setLoginError('รหัสผ่านไม่ถูกต้อง');
      }
    }
  };

  const handleLogout = () => {
    api.adminLogout();
    setIsAuthenticated(false);
  };

  const openRoomControl = (roomId: string) => {
    setSelectedRoomId(roomId);
    setCurrentView('room');
    setActiveTab('queue');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await api.createRoom(newRoomName.trim());
      setShowCreateModal(false);
      setNewRoomName('');
      showToast(`สร้างห้อง "${res.room.name}" สำเร็จ!`);
      await loadDashboard();
      openRoomControl(res.room.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'สร้างห้องไม่สำเร็จ');
    }
  };

  const handleToggleRoomStatus = async () => {
    if (!roomDetail) return;
    const nextStatus = roomDetail.room.status === 'open' ? 'closed' : 'open';
    try {
      await api.updateRoom(roomDetail.room.id, { status: nextStatus });
      showToast(`ปรับสถานะเป็น: ${nextStatus === 'open' ? 'เปิดรับเพลง' : 'ปิดรับเพลง'}`);
      loadRoomDetail(roomDetail.room.id);
      loadDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRotateCode = async () => {
    if (!roomDetail) return;
    if (!confirm('สุ่มรหัสห้องใหม่หรือไม่? QR Code เดิมและผู้ร่วมงานจะต้องสแกนรหัสใหม่')) return;
    try {
      const res = await api.rotateRoomCode(roomDetail.room.id);
      showToast(`เปลี่ยนรหัสห้องเป็น: ${res.room.code}`);
      loadRoomDetail(roomDetail.room.id);
      loadDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomDetail) return;
    try {
      if (editRoomName.trim() && editRoomName.trim() !== roomDetail.room.name) {
        await api.updateRoom(roomDetail.room.id, { name: editRoomName.trim() });
      }
      await api.updateRoomSettings(roomDetail.room.id, settingsForm);
      showToast('บันทึกการตั้งค่าห้องสำเร็จ!');
      loadRoomDetail(roomDetail.room.id);
      loadDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayerCommand = async (command: 'pause' | 'play' | 'skip' | 'start') => {
    if (!roomDetail) return;
    try {
      await api.sendPlayerCommand(roomDetail.room.id, command);
      const labels = {
        pause: 'สั่งหยุดชั่วคราว (Pause)',
        play: 'สั่งเล่นต่อ (Resume)',
        skip: 'สั่งข้ามเพลง (Skip)',
        start: 'สั่งเริ่มเล่น (Start Playback)',
      };
      showToast(`ส่งคำสั่ง: ${labels[command]}`);
      loadRoomDetail(roomDetail.room.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorderSong = async (songId: string, direction: 'up' | 'down') => {
    if (!roomDetail) return;
    try {
      await api.reorderSong(roomDetail.room.id, songId, direction);
      loadRoomDetail(roomDetail.room.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!roomDetail) return;
    try {
      await api.removeSong(roomDetail.room.id, songId);
      showToast('ลบเพลงออกจากคิวแล้ว');
      loadRoomDetail(roomDetail.room.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearQueue = async () => {
    if (!roomDetail) return;
    try {
      await api.clearQueue(roomDetail.room.id);
      setShowClearConfirm(false);
      showToast('ล้างคิวเพลงทั้งหมดแล้ว');
      loadRoomDetail(roomDetail.room.id);
    } catch (err) {
      console.error(err);
    }
  };

  // If not logged in, show sleek login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-16 flex flex-col items-center justify-center">
          <div className="glass-panel p-8 rounded-2xl w-full border border-white/10 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-purple to-accent-cyan p-0.5 mx-auto mb-4 shadow-lg shadow-accent-purple/25">
              <div className="w-full h-full bg-jukebox-bg rounded-[14px] flex items-center justify-center text-accent-cyan">
                <Shield className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">QR Music Control Center</h2>
            <p className="text-xs text-slate-400 mb-6">
              เข้าสู่ระบบศูนย์ควบคุมเพื่อจัดการห้อง, คิวเพลง และหน้าจอ Player
            </p>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน Admin (เช่น TM-OPERA_O)"
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-accent-rose/15 border border-accent-rose/30 text-xs text-accent-rose text-left">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold text-sm shadow-lg shadow-accent-purple/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                เข้าสู่ Control Center
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Count offline players in active rooms for alert bar
  const offlineAlertRooms = rooms.filter(
    (r) => r.status === 'open' && !r.playerOnline
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Floating Toast Notification */}
      {actionSuccess && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-accent-green/90 text-white text-xs font-bold shadow-2xl backdrop-blur flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col gap-6">
        {/* ========================================================= */}
        {/* VIEW 1: DASHBOARD (ภาพรวมทุกห้อง)                          */}
        {/* ========================================================= */}
        {currentView === 'dashboard' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Top Navigation & Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-white/10">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-purple">
                    QR MUSIC / ADMIN
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green text-[10px] font-bold border border-accent-green/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                    System Online
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white mt-1">Control Center Dashboard</h1>
                <p className="text-xs text-slate-400">
                  ตรวจสอบสถานะห้อง, คิวเพลงทั้งหมด และตรวจจับปัญหา Player แบบเรียลไทม์
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-xs font-bold shadow-lg shadow-accent-purple/20 hover:scale-105 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างห้องใหม่</span>
                </button>

                <button
                  onClick={loadDashboard}
                  className="p-2.5 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white transition-colors border border-white/10"
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose text-xs font-medium transition-colors border border-accent-rose/20"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Offline Players Alert Banner */}
            {offlineAlertRooms.length > 0 && (
              <div className="glass-panel p-4 rounded-xl border border-accent-amber/40 bg-gradient-to-r from-accent-amber/15 via-jukebox-surface/60 to-transparent flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent-amber/20 border border-accent-amber/40 flex items-center justify-center text-accent-amber shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      แจ้งเตือน: ตรวจพบ {offlineAlertRooms.length} ห้องที่ยังไม่มี Player ออนไลน์
                    </h4>
                    <p className="text-xs text-slate-300">
                      ห้อง: {offlineAlertRooms.map((r) => `${r.name} (${r.code})`).join(', ')} — กรุณาเปิดหน้าจอ Player ประจำห้องเพื่อเริ่มฉายเพลง
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Key Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Rooms */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Active Rooms</span>
                  <Users className="w-4 h-4 text-accent-cyan" />
                </div>
                <div>
                  <span className="text-3xl lg:text-4xl font-black text-white">
                    {stats?.activeRoomsCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-500 ml-1.5 font-mono">
                    / {stats?.totalRoomsCount ?? 0}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">ห้องที่เปิดรับเพลงอยู่</span>
              </div>

              {/* Queued Songs */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Queued Songs</span>
                  <ListMusic className="w-4 h-4 text-accent-purple" />
                </div>
                <div>
                  <span className="text-3xl lg:text-4xl font-black text-accent-purple">
                    {stats?.totalQueuedSongs ?? 0}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">เพลงรอเล่นทั้งหมด</span>
              </div>

              {/* Connected Players */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Connected Players</span>
                  <Tv className="w-4 h-4 text-accent-green" />
                </div>
                <div>
                  <span className="text-3xl lg:text-4xl font-black text-accent-green">
                    {stats?.connectedPlayersCount ?? 0}
                  </span>
                  <span className="text-xs text-slate-500 ml-1.5 font-mono">
                    / {rooms.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">Player ออนไลน์จริง</span>
              </div>

              {/* Requests Today */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
                  <span>Requests Today</span>
                  <Music className="w-4 h-4 text-accent-cyan" />
                </div>
                <div>
                  <span className="text-3xl lg:text-4xl font-black text-white">
                    {stats?.requestsTodayCount ?? 0}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1">คำขอเพลงในวันนี้</span>
              </div>
            </div>

            {/* Room Cards Grid */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">ห้องทั้งหมด (Rooms)</h3>
                <span className="text-xs text-slate-400 font-mono">{rooms.length} ห้อง</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => {
                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                      Closed
                    </span>
                  );
                  if (room.status === 'open') {
                    if (room.playerOnline) {
                      if (room.playingTitle) {
                        statusBadge = (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/20 text-accent-green border border-accent-green/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                            Playing
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40">
                            Waiting
                          </span>
                        );
                      }
                    } else {
                      statusBadge = (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-rose/20 text-accent-rose border border-accent-rose/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-rose" />
                          Player Offline
                        </span>
                      );
                    }
                  }

                  return (
                    <div
                      key={room.id}
                      className="glass-card p-5 rounded-2xl border border-white/10 hover:border-accent-purple/40 transition-all flex flex-col justify-between gap-4 group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-base text-white group-hover:text-accent-cyan transition-colors">
                            {room.name}
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/60 text-slate-300 font-bold border border-white/10">
                            {room.code}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          {statusBadge}
                          <span className="text-xs text-slate-400">
                            {room.queuedCount} เพลงในคิว
                          </span>
                        </div>

                        {room.playingTitle ? (
                          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center gap-2">
                            <Music className="w-3.5 h-3.5 text-accent-purple shrink-0" />
                            <p className="text-xs text-slate-300 truncate">
                              {room.playingTitle}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-black/20 text-xs text-slate-500 italic">
                            ไม่มีเพลงที่กำลังเล่น
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/p/${room.code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-400 hover:text-white transition-colors"
                            title="เปิดจอ Player ในแท็บใหม่"
                          >
                            <Tv className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`/r/${room.code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-400 hover:text-white transition-colors"
                            title="เปิดหน้าขอเพลง"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <button
                          onClick={() => openRoomControl(room.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent-purple/20 hover:bg-accent-purple/30 text-accent-purple text-xs font-bold border border-accent-purple/40 transition-colors"
                        >
                          <span>Manage room</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {rooms.length === 0 && (
                  <div className="col-span-full py-16 text-center text-slate-500 text-sm glass-panel rounded-2xl border border-white/5">
                    ยังไม่มีห้องในระบบ กดปุ่ม "สร้างห้องใหม่" เพื่อเริ่มต้น
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ROOM MANAGEMENT (หน้าจัดการห้องแต่ละห้อง)             */}
        {/* ========================================================= */}
        {currentView === 'room' && roomDetail && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Top Room Header */}
            <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="p-2 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white border border-white/10 transition-colors"
                  title="กลับหน้ารวม Dashboard"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl font-black text-white">{roomDetail.room.name}</h1>
                    <span className="font-mono text-sm px-2.5 py-1 rounded-lg bg-black/60 text-accent-cyan font-bold border border-white/10">
                      {roomDetail.room.code}
                    </span>
                    <button
                      onClick={handleToggleRoomStatus}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${
                        roomDetail.room.status === 'open'
                          ? 'bg-accent-green/20 text-accent-green border-accent-green/30'
                          : 'bg-accent-rose/20 text-accent-rose border-accent-rose/30'
                      }`}
                    >
                      {roomDetail.room.status === 'open' ? (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>เปิดรับเพลง</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>ปิดรับเพลง</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>
                      Player:{' '}
                      <strong className={roomDetail.playerOnline ? 'text-accent-green' : 'text-accent-rose'}>
                        {roomDetail.playerOnline ? 'ออนไลน์' : 'ออฟไลน์'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>คิว: {roomDetail.queue.length} เพลง</span>
                    <span>•</span>
                    <span>Version: {roomDetail.room.queue_version}</span>
                  </p>
                </div>
              </div>

              {/* Quick links & Refresh */}
              <div className="flex items-center gap-2">
                <a
                  href={`/p/${roomDetail.room.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 text-xs font-bold border border-accent-purple/30 transition-colors"
                >
                  <Tv className="w-4 h-4" />
                  <span>เปิดจอ Player</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <a
                  href={`/r/${roomDetail.room.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 text-xs font-bold border border-accent-cyan/30 transition-colors"
                >
                  <Radio className="w-4 h-4" />
                  <span>หน้าขอเพลง</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <button
                  onClick={() => loadRoomDetail(roomDetail.room.id)}
                  className="p-2 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white transition-colors border border-white/10"
                  title="รีเฟรชข้อมูลห้อง"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* 4 Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-1">
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'queue'
                    ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListMusic className="w-4 h-4" />
                <span>A. Queue Manager</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                  {roomDetail.queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('player')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'player'
                    ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>B. Player Control</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    roomDetail.playerOnline ? 'bg-accent-green' : 'bg-accent-rose'
                  }`}
                />
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>C. Room Settings & QR</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'logs'
                    ? 'bg-accent-purple text-white shadow-lg shadow-accent-purple/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>D. Activity Logs</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                  {roomDetail.events.length}
                </span>
              </button>
            </div>

            {/* TAB A: QUEUE MANAGER */}
            {activeTab === 'queue' && (
              <div className="flex flex-col gap-6">
                {/* NOW PLAYING CARD with Controls */}
                <div className="glass-panel p-5 rounded-2xl border border-accent-purple/30 bg-gradient-to-r from-accent-purple/15 via-jukebox-surface/70 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {roomDetail.playing ? (
                      <>
                        <img
                          src={`https://img.youtube.com/vi/${roomDetail.playing.video_id}/mqdefault.jpg`}
                          alt="thumb"
                          className="w-20 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-bold text-accent-cyan tracking-wider uppercase mb-1">
                            <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                            <span>NOW PLAYING • YouTube Player Primary</span>
                          </div>
                          <h3 className="font-extrabold text-base text-white truncate max-w-md lg:max-w-xl">
                            {roomDetail.playing.title || `Video (${roomDetail.playing.video_id})`}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                            Video ID: {roomDetail.playing.video_id}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-slate-400 text-sm flex items-center gap-2">
                        <Volume2Icon className="w-5 h-5 text-slate-500" />
                        <span>ขณะนี้ไม่มีเพลงที่กำลังเล่นอยู่</span>
                      </div>
                    )}
                  </div>

                  {/* Remote Playback Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePlayerCommand('pause')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white text-xs font-bold border border-white/10 transition-colors"
                      title="หยุดชั่วคราว (Pause)"
                    >
                      <Pause className="w-3.5 h-3.5 text-accent-amber" />
                      <span>Pause</span>
                    </button>

                    <button
                      onClick={() => handlePlayerCommand('play')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white text-xs font-bold border border-white/10 transition-colors"
                      title="เล่นต่อ (Resume)"
                    >
                      <Play className="w-3.5 h-3.5 text-accent-green fill-current" />
                      <span>Resume</span>
                    </button>

                    <button
                      onClick={() => handlePlayerCommand('skip')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent-purple/20 hover:bg-accent-purple/30 text-white text-xs font-bold border border-accent-purple/30 transition-colors"
                      title="ข้ามเพลงนี้ (Skip Song)"
                    >
                      <SkipForward className="w-3.5 h-3.5 text-accent-cyan" />
                      <span>Skip Song</span>
                    </button>
                  </div>
                </div>

                {/* UP NEXT QUEUE LIST */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white flex items-center gap-2">
                        <ListMusic className="w-5 h-5 text-accent-cyan" />
                        <span>คิวเพลงถัดไป (Up Next Queue)</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        จัดลำดับเพลงด้วยปุ่มเลื่อนขึ้น/ลง หรือลบเพลงที่ไม่เหมาะสมออกจากคิว
                      </p>
                    </div>

                    {roomDetail.queue.length > 0 && (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose text-xs font-semibold border border-accent-rose/25 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างคิวทั้งหมด</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {roomDetail.queue.map((song, idx) => (
                      <div
                        key={song.id}
                        className="glass-card p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-sm font-black text-slate-500 w-6 text-center">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <img
                            src={`https://img.youtube.com/vi/${song.video_id}/default.jpg`}
                            alt="thumb"
                            className="w-14 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-slate-200 truncate">
                              {song.title || `Video (${song.video_id})`}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              ID: {song.video_id} • ลำดับที่: #{song.position}
                            </p>
                          </div>
                        </div>

                        {/* Reorder and Delete buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleReorderSong(song.id, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
                            title="เลื่อนขึ้น"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleReorderSong(song.id, 'down')}
                            disabled={idx === roomDetail.queue.length - 1}
                            className="p-1.5 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-colors"
                            title="เลื่อนลง"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleRemoveSong(song.id)}
                            className="p-1.5 rounded-lg bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose transition-colors"
                            title="ลบออกจากคิว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {roomDetail.queue.length === 0 && (
                      <div className="text-center py-12 text-xs text-slate-500 glass-card rounded-xl">
                        ยังไม่มีเพลงในคิว ผู้ร่วมงานสามารถสแกน QR Code เพื่อส่งเพลงได้ทันที
                      </div>
                    )}
                  </div>
                </div>

                {/* PLAYED HISTORY */}
                <div className="glass-panel p-5 rounded-2xl border border-white/10">
                  <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>ประวัติเพลงที่เล่นจบแล้ว (Played History)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    แสดงเพลงล่าสุดที่เล่นจบหรือถูกข้าม
                  </p>

                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {roomDetail.history.map((song) => (
                      <div
                        key={song.id}
                        className="p-2.5 rounded-xl bg-black/20 flex items-center justify-between text-xs text-slate-400"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                              song.status === 'played'
                                ? 'bg-accent-green/20 text-accent-green'
                                : 'bg-accent-rose/20 text-accent-rose'
                            }`}
                          >
                            {song.status}
                          </span>
                          <span className="text-slate-300 truncate">
                            {song.title || song.video_id}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                          {song.finished_at
                            ? new Date(song.finished_at).toLocaleTimeString('th-TH')
                            : ''}
                        </span>
                      </div>
                    ))}

                    {roomDetail.history.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-600">
                        ยังไม่มีประวัติเพลง
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB B: PLAYER CONTROL */}
            {activeTab === 'player' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Player Monitor Card */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2 mb-1">
                      <Tv className="w-5 h-5 text-accent-purple" />
                      <span>สถานะหน้าจอ Player (Live Monitor)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">
                      ตรวจสอบว่าจอโปรเจกเตอร์หรือทีวีประจำห้องยังเชื่อมต่อและเล่นเพลงอยู่หรือไม่
                    </p>

                    <div className="flex flex-col gap-4">
                      {/* Connection status */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                        <span className="text-sm text-slate-300">สถานะการเชื่อมต่อ:</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${
                              roomDetail.playerOnline
                                ? 'bg-accent-green animate-pulse'
                                : 'bg-accent-rose'
                            }`}
                          />
                          <span
                            className={`text-sm font-bold ${
                              roomDetail.playerOnline ? 'text-accent-green' : 'text-accent-rose'
                            }`}
                          >
                            {roomDetail.playerOnline ? 'ONLINE (เชื่อมต่ออยู่)' : 'OFFLINE (ยังไม่เปิดจอ)'}
                          </span>
                        </div>
                      </div>

                      {/* Player state */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                        <span className="text-sm text-slate-300">สถานะการเล่น (Player State):</span>
                        <span className="font-mono text-sm text-accent-cyan font-bold uppercase">
                          {roomDetail.playerStatus}
                        </span>
                      </div>

                      {/* Playing song */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-xs text-slate-400 block mb-1">
                          เพลงปัจจุบันบนหน้าจอ:
                        </span>
                        <span className="text-sm font-bold text-white block truncate">
                          {roomDetail.playing?.title || 'ยังไม่มีเพลง'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`/p/${roomDetail.room.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-center font-bold text-sm shadow-lg shadow-accent-purple/20 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                  >
                    <Tv className="w-4 h-4" />
                    <span>เปิดหน้าจอ Player ในแท็บใหม่</span>
                  </a>
                </div>

                {/* Remote Controller Pad */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2 mb-1">
                      <Sparkles className="w-5 h-5 text-accent-cyan" />
                      <span>รีโมทควบคุม Player (Remote Control)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-6">
                      ส่งคำสั่งควบคุมไปยังหน้าจอ Player ผ่าน WebSocket ทันที
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handlePlayerCommand('play')}
                        className="p-4 rounded-xl glass-card border border-white/10 hover:border-accent-green/40 hover:bg-accent-green/10 flex flex-col items-center justify-center gap-2 text-center transition-all group"
                      >
                        <Play className="w-6 h-6 text-accent-green fill-current group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-white">เล่นต่อ (Resume)</span>
                      </button>

                      <button
                        onClick={() => handlePlayerCommand('pause')}
                        className="p-4 rounded-xl glass-card border border-white/10 hover:border-accent-amber/40 hover:bg-accent-amber/10 flex flex-col items-center justify-center gap-2 text-center transition-all group"
                      >
                        <Pause className="w-6 h-6 text-accent-amber group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-white">หยุดเพลง (Pause)</span>
                      </button>

                      <button
                        onClick={() => handlePlayerCommand('skip')}
                        className="p-4 rounded-xl glass-card border border-white/10 hover:border-accent-cyan/40 hover:bg-accent-cyan/10 flex flex-col items-center justify-center gap-2 text-center transition-all group"
                      >
                        <SkipForward className="w-6 h-6 text-accent-cyan group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-white">ข้ามเพลง (Skip)</span>
                      </button>

                      <button
                        onClick={() => handlePlayerCommand('start')}
                        className="p-4 rounded-xl glass-card border border-white/10 hover:border-accent-purple/40 hover:bg-accent-purple/10 flex flex-col items-center justify-center gap-2 text-center transition-all group"
                      >
                        <Radio className="w-6 h-6 text-accent-purple group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-white">Start Jukebox</span>
                        <span className="text-[10px] text-slate-500">แก้ Autoplay Blocked</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-xs text-slate-300">
                    💡 <strong>คำแนะนำ:</strong> หากโปรเจกเตอร์เพิ่งเปิดและไม่มีเสียง ให้กดปุ่ม{' '}
                    <strong>Start Jukebox</strong> เพื่อเปิดระบบเสียงตาม Autoplay Policy ของเบราว์เซอร์
                  </div>
                </div>
              </div>
            )}

            {/* TAB C: ROOM SETTINGS & QR */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form Settings */}
                <form
                  onSubmit={handleSaveSettings}
                  className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-5"
                >
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-accent-purple" />
                    <span>ตั้งค่านโยบายห้องและความปลอดภัย</span>
                  </h3>

                  {/* Room Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      ชื่อห้อง (Room Name)
                    </label>
                    <input
                      type="text"
                      value={editRoomName}
                      onChange={(e) => setEditRoomName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm focus:outline-none"
                    />
                  </div>

                  {/* Max Queue */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      จำนวนเพลงสูงสุดในคิว (Max Queue Cap)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={settingsForm.maxQueue}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, maxQueue: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      เมื่อคิวเต็ม ระบบจะปฏิเสธคำขอใหม่ชั่วคราวเพื่อป้องกันสแปม
                    </span>
                  </div>

                  {/* Cooldown Seconds */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      ระยะเวลา Cooldown ระหว่างส่งเพลง (วินาที)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={settingsForm.cooldownSeconds}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          cooldownSeconds: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      ผู้ส่งเดิมต้องรอตามเวลานี้ก่อนส่งเพลงถัดไป
                    </span>
                  </div>

                  {/* Allow Duplicates */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/30 border border-white/5">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        อนุญาตเพลงซ้ำในคิว (Allow Duplicates)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {settingsForm.allowDuplicates
                          ? 'อนุญาตให้ส่งเพลงเดิมที่อยู่ในคิวซ้ำได้'
                          : 'ห้ามส่งเพลงซ้ำหากเพลงนั้นกำลังรออยู่ในคิว'}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.allowDuplicates}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, allowDuplicates: e.target.checked })
                      }
                      className="w-5 h-5 rounded accent-accent-purple cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white text-xs font-bold shadow-lg shadow-accent-purple/20 hover:scale-[1.01] transition-all"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </form>

                {/* QR Code & Security Rotation */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-between text-center gap-6">
                  <div>
                    <h3 className="font-bold text-base text-white mb-1">QR Code ประจำห้อง</h3>
                    <p className="text-xs text-slate-400 mb-4 max-w-xs">
                      ดาวน์โหลดหรือฉาย QR Code เพื่อให้ผู้ร่วมงานสแกนขอเพลง
                    </p>

                    <QRCodeDisplay
                      roomCode={roomDetail.room.code}
                      publicUrl={roomDetail.publicUrl}
                      size={200}
                      showLink={true}
                    />
                  </div>

                  {/* Rotate Room Code */}
                  <div className="w-full pt-4 border-t border-white/10 flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-400">
                      หากมีคนก่อกวนหรือเริ่มกิจกรรมรอบใหม่ สามารถสุ่มรหัสห้องใหม่ได้:
                    </span>
                    <button
                      onClick={handleRotateCode}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jukebox-surface hover:bg-jukebox-hover text-xs font-bold text-accent-cyan border border-white/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>สุ่มรหัสห้องใหม่ (Rotate Code)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB D: ACTIVITY LOGS */}
            {activeTab === 'logs' && (
              <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-accent-purple" />
                      <span>ประวัติเหตุการณ์ในห้อง (Activity Audit Logs)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      บันทึกลำดับเหตุการณ์ทั้งหมดตามหมายเลข version ตรวจสอบย้อนหลังได้ 100%
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-400 bg-jukebox-surface px-2.5 py-1 rounded-lg border border-white/10">
                    {roomDetail.events.length} events
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                  {roomDetail.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="glass-card p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/60 text-accent-cyan font-bold">
                          v{evt.version}
                        </span>
                        <span className="font-bold text-white uppercase tracking-wider font-mono">
                          {evt.event_type}
                        </span>
                        <span className="text-slate-400 truncate max-w-md font-mono text-[11px]">
                          {evt.payload_json}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono shrink-0">
                        {new Date(evt.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                  ))}

                  {roomDetail.events.length === 0 && (
                    <div className="text-center py-12 text-xs text-slate-500">
                      ยังไม่มีบันทึกเหตุการณ์ในห้องนี้
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Create Room */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/15 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">สร้างห้องใหม่</h3>
            <p className="text-xs text-slate-400 mb-4">
              กำหนดชื่อห้องสำหรับกิจกรรมหรือห้องเรียนของคุณ
            </p>

            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="ชื่อห้อง (เช่น ห้อง ม.4/1, ห้องประชุม A)"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm focus:outline-none"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold text-xs shadow-lg shadow-accent-purple/30 hover:scale-105 transition-all disabled:opacity-50"
                >
                  สร้างห้อง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Clear Queue Confirm */}
      {showClearConfirm && roomDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-accent-rose/30 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-accent-rose/20 text-accent-rose flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">ยืนยันการล้างคิวเพลง?</h3>
            <p className="text-xs text-slate-400 mb-6">
              เพลงทั้งหมด {roomDetail.queue.length} เพลง ในคิวของห้อง "{roomDetail.room.name}" จะถูกนำออกทั้งหมดและไม่สามารถกู้คืนได้
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleClearQueue}
                className="px-5 py-2 rounded-xl bg-accent-rose text-white font-bold text-xs shadow-lg shadow-accent-rose/30 hover:bg-accent-rose/90 transition-all"
              >
                ยืนยันล้างคิว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple icon fallback
function Volume2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
