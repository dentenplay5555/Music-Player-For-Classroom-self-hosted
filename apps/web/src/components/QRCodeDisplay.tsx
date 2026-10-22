import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  roomCode: string;
  publicUrl?: string;
  size?: number;
  showLink?: boolean;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  roomCode,
  publicUrl,
  size = 180,
  showLink = true,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  // If publicUrl is provided from server (e.g. LAN IP http://192.168.1.143:5173), use it!
  const base = publicUrl ? publicUrl.replace(/\/+$/, '') : window.location.origin;
  const requestUrl = `${base}/r/${roomCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(requestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* QR Code Container with neon ring glow */}
      <div className="relative p-3.5 bg-white rounded-2xl shadow-xl shadow-accent-purple/15 border border-white/20 transition-transform duration-300 hover:scale-[1.02]">
        <QRCodeSVG
          value={requestUrl}
          size={size}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎵</text></svg>',
            x: undefined,
            y: undefined,
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      {showLink && (
        <div className="flex items-center gap-2 max-w-full">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-jukebox-surface/80 border border-jukebox-border text-slate-300 hover:text-white hover:border-accent-purple/50 transition-colors"
            title="คัดลอกลิงก์ขอเพลง"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent-green" />
                <span className="text-accent-green font-medium">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>คัดลอกลิงก์</span>
              </>
            )}
          </button>

          <a
            href={requestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jukebox-surface/80 border border-jukebox-border text-slate-300 hover:text-white hover:border-accent-cyan/50 transition-colors"
            title="เปิดหน้าขอเพลง"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span>เปิดหน้าเว็บ</span>
          </a>
        </div>
      )}
    </div>
  );
};
