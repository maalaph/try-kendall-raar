'use client';

import { colors } from '@/lib/config';

export default function SimpleDot() {
  const baseSize = 50;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 'clamp(120px, 15vw, 150px)',
        height: 'clamp(120px, 15vw, 150px)',
        pointerEvents: 'none',
      }}
    >
      {/* Outer glow layer */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize * 1.8}px`,
          height: `${baseSize * 1.8}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}30 0%, ${colors.accent}00 70%)`,
          filter: `blur(${20}px)`,
          opacity: 0.6,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'float-glow 4s ease-in-out infinite',
        }}
      />

      {/* Middle glow layer */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize * 1.4}px`,
          height: `${baseSize * 1.4}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}50 0%, ${colors.accent}00 65%)`,
          filter: `blur(${12}px)`,
          opacity: 0.8,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'float-glow 3s ease-in-out infinite',
          animationDelay: '0.2s',
        }}
      />

      {/* Core glow */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize}px`,
          height: `${baseSize}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}100 0%, ${colors.accent}60 50%, ${colors.accent}00 100%)`,
          filter: `blur(${8}px)`,
          opacity: 0.75,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'float-glow 2s ease-in-out infinite',
          boxShadow: `0 0 20px ${colors.accent}80`,
        }}
      />

      {/* Inner core */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize * 0.5}px`,
          height: `${baseSize * 0.5}px`,
          borderRadius: '50%',
          background: colors.accent,
          opacity: 0.95,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse-core 2s ease-in-out infinite',
          boxShadow: `0 0 15px ${colors.accent}, 0 0 30px ${colors.accent}80`,
        }}
      />
    </div>
  );
}

