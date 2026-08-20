import { useId, type ReactNode } from 'react';
import { formatElapsed } from './format';

interface CircularTimerProps {
  elapsedMs: number;
  isLive: boolean;
  size?: number;
}

/** A glowing ring clock — sweeps once per real-world minute (seconds-within-minute as the
 *  fraction), gradient stroke from electric-blue to soft-violet, per the "Electric Sapphire"
 *  design system (stitch_codesense_coach/electric_sapphire/DESIGN.md): glow effects over flat
 *  shadows, gradient accents for anything meant to feel "alive". Pure SVG + inline styles, no
 *  Tailwind classes — this file is shared between the Vite-built dashboard and the esbuild-built
 *  content-script overlay, which have no CSS pipeline in common. */
export function CircularTimer({ elapsedMs, isLive, size = 72 }: CircularTimerProps) {
  const gradientId = useId();
  const strokeWidth = Math.max(3, size * 0.055);
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const secondsInMinute = Math.floor(elapsedMs / 1000) % 60;
  const dashOffset = circumference * (1 - secondsInMinute / 60);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isLive ? `url(#${gradientId})` : 'rgba(190,200,210,0.35)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            filter: isLive ? 'drop-shadow(0 0 5px rgba(14,165,233,0.65))' : undefined,
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 700,
            fontSize: Math.max(9, size * 0.17),
            color: '#dee3e9',
            letterSpacing: '-0.02em',
          }}
        >
          {formatElapsed(elapsedMs)}
        </span>
      </div>
    </div>
  );
}

interface RingBadgeProps {
  elapsedMs: number;
  isLive: boolean;
  size: number;
  children: ReactNode;
}

/** Thin ring wrapper for the overlay's collapsed bubble button — the clock stays visible even
 *  before the user expands the panel, so it's the very first thing they see. */
export function RingBadge({ elapsedMs, isLive, size, children }: RingBadgeProps) {
  const gradientId = useId();
  const strokeWidth = Math.max(2, size * 0.045);
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const secondsInMinute = Math.floor(elapsedMs / 1000) % 60;
  const dashOffset = circumference * (1 - secondsInMinute / 60);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isLive ? `url(#${gradientId})` : 'rgba(255,255,255,0.4)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {children}
    </div>
  );
}
