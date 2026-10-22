import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { api, connectRoomWebSocket, ApiError } from '../api/client';
import { QueueSnapshot, Song } from '@qr-music/shared';
import {
  Send,
  Music,
  CheckCircle2,
  AlertCircle,
  Clock,
  ListMusic,
  Clipboard,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';

export const RequestPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ title: string | null; position: number } | null>(
    null
  );
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Load initial snapshot
  const loadQueue = async () => {
    if (!roomCode) return;
    try {
      const data = await api.getQueue(roomCode);
      setSnapshot(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('ไม่สามารถเชื่อมต่อกับห้องได้');
      }
    }
  };

  useEffect(() => {
    loadQueue();

    if (!roomCode) return;

    // Connect WebSocket
    const cleanup = connectRoomWebSocket(
      roomCode,
      (msg) => {
        if (msg.type === 'queue.updated') {
          // Re-fetch snapshot or update directly
          loadQueue();
        } else if (msg.type === 'song.added' || msg.type === 'song.started' || msg.type === 'song.skipped') {
          loadQueue();
        } else if (msg.type === 'room.updated') {
          loadQueue();
        }
      },
      setWsStatus
    );

    return cleanup;
  }, [roomCode]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setYoutubeUrl(text);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !youtubeUrl.trim() || loading) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);

    try {
      const res = await api.addSong(roomCode, youtubeUrl.trim());
      setSuccessInfo({
        title: res.song.title,
        position: res.position,
      });
      setYoutubeUrl('');
      // Reload queue
      loadQueue();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('เกิดข้อผิดพลาดในการส่งเพลง กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  const room = snapshot?.room;
  const isClosed = room && room.status !== 'open';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar roomCode={roomCode} roomName={room?.name} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
        {/* Connection & Room Status */}
        <div className="flex items-center justify-between text-xs px-2">
          <div className="flex items-center gap-1.5">
            {wsStatus === 'connected' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-accent-green" />
                <span className="text-accent-green font-medium">Realtime เชื่อมต่อแล้ว</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500">กำลังเชื่อมต่อ...</span>
              </>
            )}
          </div>
          {room && (
            <span
              className={`px-2.5 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                room.status === 'open'
                  ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                  : 'bg-accent-rose/20 text-accent-rose border border-accent-rose/30'
              }`}
            >
              {room.status === 'open' ? 'เปิดรับคำขอเพลง' : 'ปิดรับเพลงชั่วคราว'}
            </span>
          )}
        </div>

        {/* Request Form Card */}
        <div className="glass-panel p-5 rounded-2xl shadow-xl border border-white/10">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Radio className="w-5 h-5 text-accent-purple" />
            <span>ขอเพลงเข้าคิว</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            วางลิงก์ YouTube (คลิปเพลง, MV หรือ Shorts) เพลงจะเข้าคิวของห้องทันที
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="วาง YouTube URL ที่นี่..."
                disabled={loading || isClosed}
                className="w-full pl-3.5 pr-20 py-3 rounded-xl glass-input text-white text-sm placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={loading || isClosed}
                className="absolute right-2 top-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                title="วางลิงก์จากคลิปบอร์ด"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>วาง</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-accent-rose/15 border border-accent-rose/30 flex items-start gap-2.5 text-xs text-accent-rose animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Banner */}
            {successInfo && (
              <div className="p-3.5 rounded-xl bg-accent-green/15 border border-accent-green/30 flex items-start gap-2.5 text-xs text-white animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-accent-green mb-0.5">
                    ส่งเพลงเข้าคิวสำเร็จ! (ลำดับที่ #{successInfo.position})
                  </p>
                  <p className="text-slate-300 truncate max-w-xs sm:max-w-md">
                    {successInfo.title || 'YouTube Video'}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !youtubeUrl.trim() || isClosed}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังส่งเข้าคิว...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>เพิ่มเพลงเข้าคิว (Add to Queue)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Now Playing Card */}
        {snapshot?.playing && (
          <div className="glass-panel p-4 rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/10 to-transparent">
            <div className="flex items-center justify-between text-xs text-accent-cyan font-bold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-cyan animate-ping" />
                กำลังเล่นอยู่ (Now Playing)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={`https://img.youtube.com/vi/${snapshot.playing.video_id}/mqdefault.jpg`}
                alt="thumbnail"
                className="w-16 h-12 rounded-lg object-cover border border-white/10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-white truncate">
                  {snapshot.playing.title || `YouTube Video (${snapshot.playing.video_id})`}
                </h4>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Music className="w-3 h-3 text-accent-purple" />
                  <span>ขอโดยไม่ระบุตัวตน</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Queue */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-accent-cyan" />
              <span>คิวถัดไป (Up Next)</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-jukebox-surface text-slate-400 font-mono">
              {snapshot?.queue?.length || 0} เพลงในคิว
            </span>
          </div>

          {snapshot?.queue && snapshot.queue.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {snapshot.queue.map((song: Song, index: number) => (
                <div
                  key={song.id}
                  className="glass-card p-2.5 rounded-xl flex items-center gap-3 border border-white/5 hover:border-white/15 transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-slate-500 w-5 text-center">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <img
                    src={`https://img.youtube.com/vi/${song.video_id}/default.jpg`}
                    alt="thumbnail"
                    className="w-12 h-9 rounded object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {song.title || `YouTube Video (${song.video_id})`}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>สถานะ: รอเล่น</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              ยังไม่มีเพลงในคิวลำดับถัดไป คุณสามารถส่งเพลงคนแรกได้เลย!
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
