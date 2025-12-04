'use client';

import { colors } from '@/lib/config';

interface TypingIndicatorProps {
  assistantName?: string;
  showWaveform?: boolean;
}

export default function TypingIndicator({ assistantName = 'Kendall', showWaveform = false }: TypingIndicatorProps) {
  return (
    <div
      className="flex w-full mb-8 animate-in fade-in duration-300"
      style={{
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingLeft: 'clamp(1rem, 4vw, 2rem)',
        paddingRight: 'clamp(1rem, 4vw, 2rem)',
      }}
    >
      <div
        className="max-w-[75%] sm:max-w-[65%] rounded-xl px-5 py-3.5 relative"
        style={{
          backgroundColor: '#1a1a1a',
          color: colors.text,
          border: `1px solid ${colors.accent}20`,
        }}
      >
        {/* Subtle pulsing aura for typing state */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${colors.accent}15 0%, transparent 70%)`,
            animation: 'pulse-aura-typing 2s ease-in-out infinite',
            zIndex: 0,
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          {showWaveform ? (
            <div className="flex items-end gap-1 h-6">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full"
                  style={{
                    backgroundColor: colors.accent,
                    height: '100%',
                    animation: `waveform ${0.6 + i * 0.1}s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: colors.accent,
                    animation: 'typing-dots 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          )}
          <span
            className="text-sm"
            style={{
              color: colors.text,
              opacity: 0.6,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            {assistantName} is thinking...
          </span>
        </div>
      </div>
    </div>
  );
}



