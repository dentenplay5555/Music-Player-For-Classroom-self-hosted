import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { api, connectRoomWebSocket } from '../api/client';
import { QueueSnapshot, Song } from '@qr-music/shared';
import {
  Maximize2,
  Minimize2,
  SkipForward,
  ListMusic,
  Radio,
  Wifi,
  Sparkles,
  Volume2,
} from 'lucide-react';

export const PlayerPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerState, setPlayerState] = useState<string>('Ready');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const loadQueue = async () => {
    if (!roomCode) return;
    try {
      const data = await api.getQueue(roomCode);
      setSnapshot(data);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  const ytRef = React.useRef<import('../components/YouTubePlayer').YouTubePlayerHandle>(null);

  useEffect(() => {
    loadQueue();

    if (!roomCode) return;

    // Send initial heartbeat and every 15 seconds
    api.sendPlayerHeartbeat(roomCode, playerState).catch(() => {});
    const heartbeatTimer = setInterval(() => {
      api.sendPlayerHeartbeat(roomCode, playerState).catch(() => {});
    }, 15000);

    const cleanup = connectRoomWebSocket(
      roomCode,
      (msg) => {
        if (msg.type === 'queue.updated' || msg.type === 'song.added' || msg.type === 'song.started' || msg.type === 'song.skipped') {
          loadQueue();
        } else if (msg.type === 'player.command') {
          const cmd = (msg.payload as any)?.command;
          if (cmd === 'pause') {
            ytRef.current?.pauseVideo();
          } else if (cmd === 'play') {
            ytRef.current?.playVideo();
          } else if (cmd === 'start') {
            ytRef.current?.startJukebox();
          } else if (cmd === 'skip') {
            handleManualSkip();
          }
        }
      },
      setWsStatus
    );

    return () => {
      clearInterval(heartbeatTimer);
      cleanup();
    };
  }, [roomCode, playerState]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // When YouTube player ends a video, tell server to advance queue
  const handleSongEnded = async () => {
    if (!roomCode) return;
    try {
      await api.nextSong(roomCode);
      loadQueue();
    } catch (err) {
      console.error('Failed to advance song:', err);
    }
  };

  const handleManualSkip = async () => {
    if (!roomCode || !snapshot?.playing) return;
    try {
      await api.nextSong(roomCode);
      loadQueue();
    } catch (err) {
      console.error('Failed to skip song:', err);
    }
  };

  const room = snapshot?.room;
  const currentSong = snapshot?.playing;
  const queue = snapshot?.queue || [];

  return (
    <div className={`min-h-screen flex flex-col ${isFullscreen ? 'bg-black' : ''}`}>
      {!isFullscreen && <Navbar roomCode={roomCode} roomName={room?.name} />}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Player & Now Playing */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Top Bar for Fullscreen Controls & Room Info */}
          <div className="flex items-center justify-between glass-panel px-4 py-2.5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse" />
              <span className="font-bold text-sm text-white tracking-wide">
                {room?.name || 'Classroom Player'}
              </span>
              <span className="px-2 py-0.5 rounded bg-jukebox-surface text-slate-400 font-mono text-xs">
                {roomCode}
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                • {playerState}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentSong && (
                <button
                  onClick={handleManualSkip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white text-xs transition-colors border border-white/10"
                  title="ข้ามเพลงนี้"
                >
                  <SkipForward className="w-3.5 h-3.5 text-accent-cyan" />
                  <span className="hidden sm:inline">ข้ามเพลง</span>
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-jukebox-surface hover:bg-jukebox-hover text-slate-300 hover:text-white transition-colors border border-white/10"
                title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'แสดงเต็มจอ'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-accent-purple" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-accent-purple" />
                )}
              </button>
            </div>
          </div>

          {/* YouTube Player */}
          <div className="w-full">
            <YouTubePlayer
              ref={ytRef}
              videoId={currentSong?.video_id || null}
              onEnded={handleSongEnded}
              onStateChange={setPlayerState}
            />
          </div>

          {/* Now Playing Details Bar */}
          {currentSong ? (
            <div className="glass-panel p-4 rounded-2xl border border-accent-purple/30 bg-gradient-to-r from-accent-purple/15 via-jukebox-surface/60 to-transparent flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-accent-cyan tracking-wider uppercase mb-1">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>กำลังเล่น (Now Playing)</span>
                </div>
                <h2 className="text-base sm:text-xl font-extrabold text-white truncate">
                  {currentSong.title || `YouTube Video (${currentSong.video_id})`}
                </h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
                  <span>เพลงที่ส่งเข้าคิวแบบไม่ระบุตัวตน</span>
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  VIDEO ID
                </span>
                <span className="text-xs font-mono text-slate-300 bg-black/40 px-2 py-1 rounded border border-white/10">
                  {currentSong.video_id}
                </span>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-4 rounded-2xl border border-white/10 text-center text-sm text-slate-400">
              ไม่มีเพลงที่กำลังเล่นอยู่ ส่งเพลงผ่าน QR Code ได้ทันที
            </div>
          )}
        </div>

        {/* Right Column: QR Code & Up Next Queue */}
        <div className="w-full lg:w-96 flex flex-col gap-5">
          {/* QR Code Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/15 shadow-2xl flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-accent-cyan mb-2">
              <Radio className="w-3.5 h-3.5" />
              <span>SCAN TO REQUEST</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">สแกนเพื่อส่งเพลงเข้าคิว</h3>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              เปิดกล้องมือถือสแกน QR Code แล้ววางลิงก์ YouTube ได้ทันที
            </p>

            {roomCode && (
              <QRCodeDisplay
                roomCode={roomCode}
                publicUrl={snapshot?.publicUrl}
                size={180}
                showLink={true}
              />
            )}
          </div>

          {/* Up Next List */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-accent-purple" />
                <h4 className="font-bold text-sm text-white">เพลงถัดไป (Up Next)</h4>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-jukebox-surface text-slate-400">
                {queue.length} เพลง
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-96 flex flex-col gap-2 pr-1">
              {queue.length > 0 ? (
                queue.map((song: Song, index: number) => (
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
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {song.title || `YouTube Video (${song.video_id})`}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {song.video_id}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-slate-500">
                  <span>ยังไม่มีเพลงในคิวถัดไป</span>
                  <span className="text-[11px] text-slate-600 mt-1">
                    สแกน QR Code ด้านบนเพื่อส่งเพลงคนแรก
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
