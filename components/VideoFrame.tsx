'use client';

import { colors } from '@/lib/config';

interface VideoFrameProps {
  videoSrc?: string;
  videoSrcWebm?: string;
  posterSrc?: string;
}

export default function VideoFrame({ videoSrc, videoSrcWebm, posterSrc }: VideoFrameProps) {
  return (
    <div className="relative w-full">
      {/* Purple aura glow effect */}
      <div 
        className="relative rounded-lg overflow-hidden"
        style={{
          border: `2px solid ${colors.primary}`,
          animation: 'aura-pulse 3s ease-in-out infinite',
          aspectRatio: '16/9',
        }}
      >
        {videoSrc ? (
          /* Actual video player */
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            style={{ backgroundColor: colors.primary }}
          >
            {videoSrcWebm && (
              <source src={videoSrcWebm} type="video/webm" />
            )}
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          /* Video placeholder - black frame with purple aura */
          <div 
            className="w-full h-full relative"
            style={{ 
              backgroundColor: colors.primary,
              minHeight: '300px',
            }}
          >
            {/* Play button centered in video */}
            <div 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            >
              <div className="relative inline-block">
                {/* Animated outer ring */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `3px solid ${colors.accent}`,
                    opacity: 0.5,
                    animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    transform: 'scale(1.3)',
                  }}
                />
                {/* Play button circle with glow */}
                <div
                  className="relative flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: `${colors.accent}20`,
                    border: `2px solid ${colors.accent}`,
                    boxShadow: `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`,
                    animation: 'pulse-glow 2s ease-in-out infinite',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`;
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Play triangle */}
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: `20px solid ${colors.accent}`,
                      borderTop: '12px solid transparent',
                      borderBottom: '12px solid transparent',
                      marginLeft: '4px',
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Text below centered */}
            <div 
              className="absolute left-1/2 transform -translate-x-1/2 text-center px-4"
              style={{ bottom: '2rem' }}
            >
              <p 
                className="text-sm sm:text-base md:text-lg font-light tracking-wide"
                style={{ color: colors.text }}
              >
                See{' '}
                <span
                  style={{
                    fontFamily: 'var(--font-league-spartan), sans-serif',
                    fontWeight: 700,
                    color: colors.accent,
                  }}
                >
                  Kendall
                </span>
                {' '}in action.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

