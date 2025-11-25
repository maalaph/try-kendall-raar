'use client';

import { useState, useRef, useEffect } from 'react';
import { colors, kendallPhoneNumber } from '@/lib/config';

interface VideoFrameProps {
  videoSrc?: string;
  videoSrcWebm?: string;
  posterSrc?: string;
}

export default function VideoFrame({ videoSrc, videoSrcWebm, posterSrc }: VideoFrameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
      setHasStarted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
    }
  };

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSpeedMenu && videoRef.current && !videoRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSpeedMenu]);

  return (
    <div className="relative w-full">
      {/* Purple aura glow effect */}
      <div 
        className="relative rounded-lg overflow-hidden group"
        style={{
          border: `2px solid ${colors.primary}`,
          boxShadow: `0 0 20px ${colors.accent}30, 0 0 40px ${colors.accent}20, 0 0 60px ${colors.accent}10`,
          aspectRatio: '16/9',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30, 0 0 90px ${colors.accent}20`;
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30, 0 0 40px ${colors.accent}20, 0 0 60px ${colors.accent}10`;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {videoSrc ? (
          /* Actual video player with play button overlay */
          <div className="relative w-full h-full" style={{ backgroundColor: colors.primary }}>
            <div className="relative w-full h-full" id="video-container">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                preload="none"
                controls
                onPlay={() => {
                  setIsPlaying(true);
                  setHasStarted(true);
                }}
                onPause={() => setIsPlaying(false)}
                onLoadedData={() => {
                  // Video has loaded, but don't set hasStarted until user clicks play
                }}
                onClick={(e) => {
                  // Close speed menu if clicking on video
                  if (showSpeedMenu) {
                    setShowSpeedMenu(false);
                  }
                }}
                style={{ 
                  backgroundColor: colors.primary,
                  zIndex: hasStarted ? 10 : 1,
                  pointerEvents: 'auto'
                }}
              >
                {videoSrcWebm && (
                  <source src={videoSrcWebm} type="video/webm" />
                )}
                <source src={videoSrc} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Custom playback speed button - positioned to match native controls */}
              {hasStarted && (
                <div 
                  className="absolute bottom-0 right-0 flex items-center"
                  style={{ 
                    height: '48px',
                    zIndex: isFullscreen ? 2147483647 : 1000,
                    pointerEvents: 'auto',
                    paddingRight: '8px',
                    gap: '4px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Speed button - styled like native circular control button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowSpeedMenu(!showSpeedMenu);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    style={{
                      background: showSpeedMenu ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      border: showSpeedMenu ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                      borderRadius: '50%',
                      color: '#fff',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontWeight: 500,
                      padding: 0,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!showSpeedMenu) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showSpeedMenu) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    title="Playback speed"
                  >
                    {playbackRate}x
                  </button>

                  {/* Speed menu dropdown - styled like native menu */}
                  {showSpeedMenu && (
                    <div
                      style={{
                        position: isFullscreen ? 'fixed' : 'absolute',
                        bottom: isFullscreen ? '48px' : '48px',
                        right: isFullscreen ? '8px' : '0',
                        backgroundColor: 'rgba(28, 28, 28, 0.95)',
                        borderRadius: '8px',
                        padding: '6px 0',
                        minWidth: '120px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.9)',
                        zIndex: isFullscreen ? 2147483647 : 10001,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {speedOptions.map((rate) => (
                        <button
                          key={rate}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handlePlaybackRateChange(rate);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: rate === playbackRate ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onMouseEnter={(e) => {
                            if (rate !== playbackRate) {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (rate !== playbackRate) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <span>{rate}x</span>
                          {rate === playbackRate && (
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Black background with play button overlay - shown only before video has been started */}
            {!hasStarted && (
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay();
                }}
                onMouseDown={(e) => {
                  // Prevent video controls from being triggered
                  e.stopPropagation();
                }}
                style={{ 
                  backgroundColor: colors.primary,
                  zIndex: isPlaying ? 0 : 2,
                  pointerEvents: isPlaying ? 'none' : 'auto'
                }}
              >
                {/* Play button centered */}
                <div className="relative inline-block">
                  {/* Play button circle */}
                  <div
                    className="relative flex items-center justify-center transition-all duration-300 hover:scale-110 touch-manipulation"
                    style={{
                      width: '80px',
                      height: '80px',
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

                {/* Text below centered */}
                <div 
                  className="absolute left-1/2 transform -translate-x-1/2 text-center px-4"
                  style={{ bottom: '2rem' }}
                >
                  <p 
                    className="text-sm sm:text-base md:text-lg font-light tracking-wide"
                    style={{ color: colors.text }}
                  >
                    <span style={{ fontStyle: 'italic' }}>See</span>{' '}
                    <span 
                      className="kendall-glow"
                      style={{
                        color: colors.accent,
                        opacity: 0.75,
                        fontFamily: 'var(--font-league-spartan), sans-serif',
                        fontWeight: 700,
                        display: 'inline-block',
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
                {/* Play button circle */}
                <div
                  className="relative flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 touch-manipulation"
                  style={{
                    width: '80px',
                    height: '80px',
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
                <span style={{ fontStyle: 'italic' }}>See</span>{' '}
                <span 
                  className="kendall-glow"
                  style={{
                    color: colors.accent,
                    opacity: 0.75,
                    fontFamily: 'var(--font-league-spartan), sans-serif',
                    fontWeight: 700,
                    display: 'inline-block',
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

      {/* Hear Kendall in action with phone button - matching structure and spacing */}
      {kendallPhoneNumber && (
        <div 
          className="relative w-full mt-12 sm:mt-16 lg:mt-20"
          style={{ aspectRatio: '16/9' }}
        >
          {/* Phone icon and text on same line, aligned with "See" text */}
          <div 
            className="absolute flex items-center justify-center gap-6 lg:gap-8 px-4"
            style={{ 
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(calc(-50% - 60px))',
            }}
          >
            {/* Phone button circle with glow */}
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
              {/* Phone button */}
              <a
                href={`tel:${kendallPhoneNumber.replace(/\D/g, '')}`}
                className="group relative flex items-center justify-center transition-all duration-300 cursor-pointer touch-manipulation w-[60px] h-[60px] lg:w-[70px] lg:h-[70px]"
                style={{
                  borderRadius: '50%',
                  backgroundColor: `${colors.accent}20`,
                  border: `2px solid ${colors.accent}`,
                  textDecoration: 'none',
                  boxShadow: `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`,
                  animation: 'pulse-glow 4s ease-in-out infinite',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 60px ${colors.accent}90, 0 0 120px ${colors.accent}70, 0 0 180px ${colors.accent}50, 0 0 240px ${colors.accent}30`;
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <svg
                  className="w-6 h-6 lg:w-8 lg:h-8"
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
            
            {/* Text next to phone icon */}
            <p 
              className="text-base sm:text-base md:text-lg font-light tracking-wide whitespace-nowrap"
              style={{ color: colors.text, marginLeft: '0.75rem' }}
            >
              <span style={{ fontStyle: 'italic' }}>Hear</span>{' '}
              <span 
                className="kendall-glow"
                style={{
                  color: colors.accent,
                  opacity: 0.75,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  fontWeight: 700,
                  display: 'inline-block',
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

