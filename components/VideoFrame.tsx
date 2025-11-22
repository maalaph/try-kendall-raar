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
            className="w-full h-full flex items-center justify-center"
            style={{ 
              backgroundColor: colors.primary,
              minHeight: '300px',
            }}
          >
            <div className="text-center space-y-4 px-4">
              <div 
                className="text-5xl sm:text-6xl mb-4"
                style={{ color: colors.accent, opacity: 0.3 }}
              >
                ▶
              </div>
              <p 
                className="text-sm font-light tracking-wide"
                style={{ color: colors.text, opacity: 0.5 }}
              >
                Kendall Live Demo
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

