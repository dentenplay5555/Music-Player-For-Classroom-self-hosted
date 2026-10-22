import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, Volume2, AlertTriangle, RefreshCw } from 'lucide-react';

export interface YouTubePlayerHandle {
  pauseVideo: () => void;
  playVideo: () => void;
  startJukebox: () => void;
}

interface YouTubePlayerProps {
  videoId: string | null;
  onEnded: () => void;
  onError?: (errorText: string) => void;
  onStateChange?: (stateName: string) => void;
  autoPlay?: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, onEnded, onError, onStateChange, autoPlay = true }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

    // Expose control methods to parent via ref
    useImperativeHandle(ref, () => ({
      pauseVideo: () => {
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      },
      playVideo: () => {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
          setAutoplayBlocked(false);
        }
      },
      startJukebox: () => {
        if (playerRef.current) {
          try {
            playerRef.current.playVideo();
            setAutoplayBlocked(false);
          } catch {
            // ignore
          }
        }
      },
    }));

    // 1. Load YouTube IFrame API script once
    useEffect(() => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else if (window.YT && window.YT.Player) {
        initPlayer();
      }

      return () => {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
        }
      };
    }, []);

    // 2. Initialize YT.Player
    const initPlayer = () => {
      if (!containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        videoId: videoId || '',
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            if (videoId && autoPlay) {
              try {
                event.target.playVideo();
              } catch {
                setAutoplayBlocked(true);
              }
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5
            if (state === 0) {
              onStateChange?.('ENDED');
              onEnded();
            } else if (state === 1) {
              setAutoplayBlocked(false);
              setErrorStatus(null);
              onStateChange?.('PLAYING');
            } else if (state === 2) {
              onStateChange?.('PAUSED');
            } else if (state === 3) {
              onStateChange?.('BUFFERING');
            }
          },
          onError: (event: any) => {
            const errCode = event.data;
            let msg = 'เกิดข้อผิดพลาดในการเล่นวิดีโอ';
            if (errCode === 100) {
              msg = 'ไม่พบวิดีโอนี้ หรือถูกตั้งเป็นส่วนตัว';
            } else if (errCode === 101 || errCode === 150) {
              msg = 'เจ้าของวิดีโอนี้ไม่อนุญาตให้เล่นนอก YouTube (Embedding Blocked)';
            }
            setErrorStatus(msg);
            onError?.(msg);

            // Auto-skip unplayable video after 4 seconds to prevent freezing the queue
            setTimeout(() => {
              onEnded();
            }, 4000);
          },
        },
      });
    };

    // 3. Update video when videoId changes
    useEffect(() => {
      if (isReady && playerRef.current && videoId) {
        setErrorStatus(null);
        setAutoplayBlocked(false);
        try {
          playerRef.current.loadVideoById(videoId);
        } catch (e) {
          console.error('Error loading video:', e);
        }
      }
    }, [videoId, isReady]);

    const handleStartPlayback = () => {
      if (playerRef.current) {
        try {
          playerRef.current.playVideo();
          setAutoplayBlocked(false);
        } catch {
          // ignore
        }
      }
    };

    if (!videoId) {
      return (
        <div className="w-full aspect-video rounded-2xl glass-card flex flex-col items-center justify-center p-8 text-center border border-white/10">
          <div className="w-16 h-16 rounded-full bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center text-accent-purple mb-4">
            <Volume2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">ยังไม่มีเพลงในคิว</h3>
          <p className="text-sm text-slate-400 max-w-md">
            สแกน QR Code ด้านขวา หรือส่ง YouTube URL เข้ามาเพื่อเริ่มเล่นเพลงแรก
          </p>
        </div>
      );
    }

    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden glass-panel border border-white/15 shadow-2xl shadow-accent-purple/10 group">
        {/* YouTube IFrame target element */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Autoplay blocked overlay per scope.md section 9.2 */}
        {autoplayBlocked && (
          <div className="absolute inset-0 bg-jukebox-bg/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-full bg-accent-purple/20 border border-accent-purple flex items-center justify-center text-accent-purple mb-4 animate-bounce">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">เริ่มเล่นเสียงบนหน้าจอนี้</h4>
            <p className="text-sm text-slate-300 max-w-sm mb-6">
              เบราว์เซอร์ต้องการให้ผู้ใช้กดเริ่มเล่นเพลงครั้งแรกเพื่อเปิดเสียง (Autoplay Policy)
            </p>
            <button
              onClick={handleStartPlayback}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold shadow-lg shadow-accent-purple/30 hover:scale-105 active:scale-95 transition-all"
            >
              Start Jukebox
            </button>
          </div>
        )}

        {/* Unplayable Error Overlay */}
        {errorStatus && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-full bg-accent-rose/20 border border-accent-rose flex items-center justify-center text-accent-rose mb-3">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">วิดีโอนี้เล่นไม่ได้</h4>
            <p className="text-sm text-slate-300 max-w-md mb-4">{errorStatus}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-accent-cyan" />
              <span>กำลังข้ามไปยังเพลงถัดไปให้อัตโนมัติ...</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
