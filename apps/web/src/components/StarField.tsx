import React, { useEffect, useRef, useCallback } from 'react';

interface Star {
  x: number;
  y: number;
  z: number; // depth 0..1 (1 = far, 0 = near)
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const STAR_COLORS = [
  '#ffffff',
  '#e8f4ff',
  '#ffd700',
  '#ffe680',
  '#c8e6ff',
  '#ffedcc',
  '#b8d4ff',
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function createStar(w: number, h: number): Star {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random(),
    size: randomBetween(0.4, 2.5),
    opacity: randomBetween(0.3, 1),
    twinkleSpeed: randomBetween(0.5, 2.5),
    twinkleOffset: Math.random() * Math.PI * 2,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  };
}

function createShootingStar(w: number, h: number): ShootingStar {
  const angle = randomBetween(-0.6, -0.2); // downward-right diagonal
  const speed = randomBetween(8, 18);
  const life = randomBetween(40, 80);
  return {
    x: randomBetween(0, w),
    y: randomBetween(0, h * 0.5),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed + speed * 0.5,
    length: randomBetween(60, 180),
    opacity: 1,
    life,
    maxLife: life,
  };
}

interface StarFieldProps {
  starCount?: number;
  className?: string;
}

export const StarField: React.FC<StarFieldProps> = ({ starCount = 280, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const shootTimerRef = useRef(0);

  const initStars = useCallback((w: number, h: number) => {
    starsRef.current = Array.from({ length: starCount }, () => createStar(w, h));
  }, [starCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      initStars(w, h);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX / w - 0.5, y: e.clientY / h - 0.5 };
    };
    window.addEventListener('mousemove', onMouseMove);

    // Touch support
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        mouseRef.current = {
          x: e.touches[0].clientX / w - 0.5,
          y: e.touches[0].clientY / h - 0.5,
        };
      }
    };
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    const draw = () => {
      timeRef.current += 0.016;
      shootTimerRef.current++;

      ctx.clearRect(0, 0, w, h);

      // Draw nebula glow blobs (static, very subtle)
      const gradient1 = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.35);
      gradient1.addColorStop(0, 'rgba(88, 28, 200, 0.07)');
      gradient1.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, w, h);

      const gradient2 = ctx.createRadialGradient(w * 0.8, h * 0.6, 0, w * 0.8, h * 0.6, w * 0.3);
      gradient2.addColorStop(0, 'rgba(6, 120, 200, 0.06)');
      gradient2.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, w, h);

      const gradient3 = ctx.createRadialGradient(w * 0.5, h * 0.8, 0, w * 0.5, h * 0.8, w * 0.25);
      gradient3.addColorStop(0, 'rgba(200, 140, 0, 0.04)');
      gradient3.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient3;
      ctx.fillRect(0, 0, w, h);

      // Parallax offset from mouse
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Draw stars
      for (const star of starsRef.current) {
        const parallaxStrength = (1 - star.z) * 28; // near stars move more
        const px = star.x + mx * parallaxStrength;
        const py = star.y + my * parallaxStrength;

        const twinkle = Math.sin(timeRef.current * star.twinkleSpeed + star.twinkleOffset);
        const alpha = Math.max(0, Math.min(1, star.opacity + twinkle * 0.35));

        // Size pulses slightly
        const size = star.size * (1 + twinkle * 0.15);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Glow for bright/near stars
        if (size > 1.2) {
          ctx.shadowBlur = size * 6;
          ctx.shadowColor = star.color;
        }

        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();

        // Draw 4-point sparkle cross for the biggest stars
        if (size > 1.8) {
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.5;
          const arm = size * 5;
          ctx.beginPath();
          ctx.moveTo(px - arm, py);
          ctx.lineTo(px + arm, py);
          ctx.moveTo(px, py - arm);
          ctx.lineTo(px, py + arm);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Spawn shooting stars randomly
      if (shootTimerRef.current > 120 && Math.random() < 0.02) {
        shootingStarsRef.current.push(createShootingStar(w, h));
        shootTimerRef.current = 0;
      }

      // Draw & update shooting stars
      shootingStarsRef.current = shootingStarsRef.current.filter((s) => s.life > 0);
      for (const s of shootingStarsRef.current) {
        s.life--;
        s.x += s.vx;
        s.y += s.vy;
        s.opacity = s.life / s.maxLife;

        const tailX = s.x - s.vx * (s.length / 12);
        const tailY = s.y - s.vy * (s.length / 12);

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(0.7, `rgba(255,245,200,${s.opacity * 0.6})`);
        grad.addColorStop(1, `rgba(255,255,255,${s.opacity})`);

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255,245,200,0.8)';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [initStars]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  );
};
