'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface KendallExpansionProps {
  isActive: boolean;
  startPosition: { x: number; y: number };
  onComplete: () => void;
}

export default function KendallExpansion({
  isActive,
  startPosition,
  onComplete,
}: KendallExpansionProps) {
  const [phase, setPhase] = useState<'expand' | 'pop' | 'complete'>('expand');

  useEffect(() => {
    if (isActive) {
      setPhase('expand');
      // Expand phase: 800ms
      const expandTimer = setTimeout(() => {
        setPhase('pop');
        // Pop phase: 400ms
        const popTimer = setTimeout(() => {
          setPhase('complete');
          setTimeout(() => {
            onComplete();
          }, 100);
        }, 400);
        return () => clearTimeout(popTimer);
      }, 800);
      return () => clearTimeout(expandTimer);
    } else {
      setPhase('expand');
    }
  }, [isActive, onComplete]);

  // Inject dynamic keyframe animations for particles
  useEffect(() => {
    if (phase === 'pop') {
      const style = document.createElement('style');
      style.id = 'kendall-expansion-particles';
      let keyframes = '';
      for (let i = 0; i < 20; i++) {
        const angle = (360 / 20) * i;
        const distance = 300;
        const endX = Math.cos((angle * Math.PI) / 180) * distance * 2;
        const endY = Math.sin((angle * Math.PI) / 180) * distance * 2;
        keyframes += `
          @keyframes pop-particle-${i} {
            0% {
              transform: translate(-50%, -50%) translate(0, 0) scale(1);
              opacity: 1;
            }
            100% {
              transform: translate(-50%, -50%) translate(${endX}px, ${endY}px) scale(0);
              opacity: 0;
            }
          }
        `;
      }
      style.textContent = keyframes;
      document.head.appendChild(style);
      
      return () => {
        const existing = document.getElementById('kendall-expansion-particles');
        if (existing) {
          document.head.removeChild(existing);
        }
      };
    }
  }, [phase]);

  if (!isActive) return null;

  // Smaller, more subtle expansion - just a pulse, not full screen
  const size = phase === 'expand' 
    ? '300px' // Small expansion from power-ups
    : phase === 'pop'
    ? '400px' // Slightly larger for pop
    : '0px';

  return (
    <>
      {/* Subtle expanding glow - just around the power-ups area */}
      <div
        style={{
          position: 'fixed',
          left: startPosition.x,
          top: startPosition.y,
          width: phase === 'complete' ? 0 : size,
          height: phase === 'complete' ? 0 : size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}${phase === 'pop' ? '60' : '40'} 0%, ${colors.accent}${phase === 'pop' ? '30' : '20'} 40%, transparent 80%)`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 10000,
          transition: phase === 'expand' 
            ? 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease'
            : phase === 'pop'
            ? 'width 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), height 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.2s ease'
            : 'width 0.1s ease, height 0.1s ease, opacity 0.1s ease',
          opacity: phase === 'complete' ? 0 : 0.6,
          filter: `blur(${phase === 'pop' ? '30px' : '20px'})`,
          boxShadow: phase === 'pop'
            ? `0 0 80px ${colors.accent}50, 0 0 120px ${colors.accent}30`
            : `0 0 60px ${colors.accent}40, 0 0 100px ${colors.accent}20`,
        }}
      />

      {/* Pop particles */}
      {phase === 'pop' && Array.from({ length: 20 }).map((_, i) => {
        const angle = (360 / 20) * i;
        const distance = 300;
        const startX = 0;
        const startY = 0;
        const endX = Math.cos((angle * Math.PI) / 180) * distance * 2;
        const endY = Math.sin((angle * Math.PI) / 180) * distance * 2;
        
        return (
          <div
            key={i}
            style={{
              position: 'fixed',
              left: startPosition.x,
              top: startPosition.y,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: colors.accent,
              transform: `translate(-50%, -50%) translate(${startX}px, ${startY}px)`,
              pointerEvents: 'none',
              zIndex: 10001,
              opacity: 1,
              animation: `pop-particle-${i} 0.4s ease-out forwards`,
              animationDelay: `${i * 0.02}s`,
              boxShadow: `0 0 20px ${colors.accent}, 0 0 40px ${colors.accent}80`,
            }}
          />
        );
      })}
    </>
  );
}

