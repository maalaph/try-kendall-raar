'use client';

import { colors, kendallPhoneNumber } from '@/lib/config';

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
        className="relative rounded-lg overflow-hidden transition-all duration-300 cursor-pointer"
        style={{
          border: `2px solid ${colors.primary}`,
          boxShadow: `0 0 20px ${colors.accent}30, 0 0 40px ${colors.accent}20, 0 0 60px ${colors.accent}10`,
          aspectRatio: '16/9',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50, 0 0 120px ${colors.accent}30`;
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30, 0 0 40px ${colors.accent}20, 0 0 60px ${colors.accent}10`;
          e.currentTarget.style.transform = 'scale(1)';
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
            className="w-full h-full relative overflow-visible"
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
                {/* Play button circle */}
                <div
                  className="relative flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 touch-manipulation w-[70px] h-[70px] lg:w-[80px] lg:h-[80px]"
                  style={{
                    borderRadius: '50%',
                    backgroundColor: `${colors.accent}20`,
                    border: `2px solid ${colors.accent}`,
                    boxShadow: `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`,
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
                    className="play-triangle"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '18px solid ' + colors.accent,
                      borderTop: '10px solid transparent',
                      borderBottom: '10px solid transparent',
                      marginLeft: '4px',
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Text below centered - desktop version */}
            <div 
              className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 text-center px-4"
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
      
      {/* Text below video - mobile only version outside overflow container */}
      <div className="lg:hidden text-center px-4 mt-4">
        <p 
          className="text-sm font-light tracking-wide"
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

      {/* Hear Kendall in action with phone button - matching structure and spacing */}
      {kendallPhoneNumber && (
        <div 
          className="relative w-full mt-14 sm:mt-16 lg:mt-20"
          style={{ aspectRatio: '16/9' }}
        >
          {/* Phone icon button - centered above text with pulsing animation, matching play button position */}
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
              {/* Phone button circle with glow - matching play button exactly */}
              <a
                href={`tel:${kendallPhoneNumber.replace(/\D/g, '')}`}
                className="group relative flex items-center justify-center transition-all duration-300 cursor-pointer touch-manipulation w-[70px] h-[70px] lg:w-[80px] lg:h-[80px]"
                style={{
                  borderRadius: '50%',
                  backgroundColor: `${colors.accent}20`,
                  border: `2px solid ${colors.accent}`,
                  textDecoration: 'none',
                  boxShadow: `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`,
                  animation: 'pulse-glow 4s ease-in-out infinite',
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
                <svg
                  className="w-7 h-7 lg:w-9 lg:h-9"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: colors.accent }}
                >
                  <path
                    d="M3 5C3 3.89543 3.89543 3 5 3H8.27924C8.70967 3 9.09181 3.27543 9.22792 3.68377L10.7257 8.17721C10.8831 8.64932 10.6694 9.16531 10.2243 9.38787L7.96701 10.5165C9.06925 12.9612 11.0388 14.9308 13.4835 16.033L14.6121 13.7757C14.8347 13.3306 15.3507 13.1169 15.8228 13.2743L20.3162 14.7721C20.7246 14.9082 21 15.2903 21 15.7208V19C21 20.1046 20.1046 21 19 21H18C9.71573 21 3 14.2843 3 6V5Z"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Text below centered - exact same spacing as "See Kendall in action." (bottom: 2rem) */}
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 text-center px-4"
            style={{ bottom: '2rem' }}
          >
            <p 
              className="text-base sm:text-base md:text-lg font-light tracking-wide"
              style={{ color: colors.text }}
            >
              Hear{' '}
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
  );
}

