'use client';

import { useState, useEffect } from 'react';
import VideoFrame from './VideoFrame';
import { heroContent, colors, kendallPhoneNumber } from '@/lib/config';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  intensity: number;
  color: string;
}

export default function Hero() {
  const [buttonSparkles, setButtonSparkles] = useState<Sparkle[]>([]);
  const [personalButtonStars, setPersonalButtonStars] = useState<Sparkle[]>([]);

  useEffect(() => {
    // Create sparkles for the button - purple/white stars
    const sparkleColors = [
      { bg: 'rgba(255, 255, 255, 1)', glow: 'rgba(255, 255, 255, 0.9)' }, // White
      { bg: 'rgba(168, 85, 247, 1)', glow: 'rgba(168, 85, 247, 0.9)' }, // Purple
      { bg: 'rgba(192, 132, 252, 1)', glow: 'rgba(192, 132, 252, 0.9)' }, // Light purple
    ];

    const initialSparkles: Sparkle[] = Array.from({ length: 12 }, (_, i) => {
      const intensity = Math.random();
      const isBright = intensity > 0.6;
      const colorIndex = Math.floor(Math.random() * sparkleColors.length);
      const starColor = sparkleColors[colorIndex];

      return {
        id: i,
        x: Math.random() * 100, // Percentage position within button
        y: Math.random() * 100,
        size: isBright ? Math.random() * 2 + 1 : Math.random() * 1.5 + 0.5,
        opacity: isBright ? Math.random() * 0.8 + 0.4 : Math.random() * 0.6 + 0.2,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        intensity: intensity,
        color: starColor.bg,
      };
    });
    setButtonSparkles(initialSparkles);

    // Create stars for the personal button
    const personalStars: Sparkle[] = Array.from({ length: 25 }, (_, i) => {
      const intensity = Math.random();
      const isBright = intensity > 0.6;
      const colorIndex = Math.floor(Math.random() * sparkleColors.length);
      const starColor = sparkleColors[colorIndex];

      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isBright ? Math.random() * 1.5 + 0.8 : Math.random() * 1 + 0.5,
        opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        intensity: intensity,
        color: starColor.bg,
      };
    });
    setPersonalButtonStars(personalStars);
  }, []);

  const scrollToBooking = () => {
    const bookingSection = document.getElementById('booking-section');
    if (bookingSection) {
      // Add hash to URL to indicate navigation from button
      window.location.hash = 'booking-section';
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Trigger animation after scroll
      setTimeout(() => {
        const event = new CustomEvent('triggerConfiguratorAnimation');
        window.dispatchEvent(event);
      }, 500);
    }
  };

  const scrollToPersonal = () => {
    const personalSection = document.getElementById('personal-section');
    if (personalSection) {
      window.location.hash = 'personal-section';
      personalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // On mount, if there's no hash, ensure we're at the top
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-36 sm:pt-32 lg:pt-40 pb-8 sm:pb-16 lg:pb-20">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-48">
          {/* Left: Video Frame */}
          <div className="order-2 lg:order-1 w-full flex flex-col items-center lg:pr-0" style={{ maxWidth: '100%', marginRight: '0', marginLeft: '0', alignSelf: 'flex-start', paddingTop: '2rem' }}>
            {/* Personal CTA Button - Above Video */}
            <button
              onClick={scrollToPersonal}
              className="group relative flex items-center justify-center overflow-visible w-full sm:w-auto touch-manipulation mb-16 lg:mb-20"
              style={{
                color: colors.text,
                backgroundColor: `${colors.accent}15`,
                border: `2.5px solid ${colors.accent}`,
                borderRadius: '14px',
                padding: '1.5rem 2.5rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                cursor: 'pointer',
                minWidth: 'auto',
                minHeight: '64px',
                transition: 'all 0.3s ease',
                boxShadow: `0 0 30px ${colors.accent}40, 0 0 60px ${colors.accent}25, 0 0 90px ${colors.accent}15`,
                outline: 'none',
                textShadow: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 45px ${colors.accent}60, 0 0 90px ${colors.accent}40, 0 0 135px ${colors.accent}25`;
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.backgroundColor = `${colors.accent}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}40, 0 0 60px ${colors.accent}25, 0 0 90px ${colors.accent}15`;
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.backgroundColor = `${colors.accent}15`;
              }}
            >
              {/* Background Stars */}
              {personalButtonStars.map((star) => {
                const glowSize = star.intensity > 0.6 ? star.size * 3 : star.size * 2;
                const glowOpacity = star.intensity > 0.6 ? 0.7 : 0.5;
                const colorMatch = star.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                const r = colorMatch ? colorMatch[1] : '255';
                const g = colorMatch ? colorMatch[2] : '255';
                const b = colorMatch ? colorMatch[3] : '255';
                const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
                const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

                return (
                  <div
                    key={star.id}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      backgroundColor: star.color,
                      opacity: star.opacity,
                      animation: `sparkle-twinkle ${star.duration}s ease-in-out infinite`,
                      animationDelay: `${star.delay}s`,
                      boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
                      zIndex: 1,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              <span style={{ position: 'relative', zIndex: 2 }}>
                Not a Business?{' '}
                <span style={{ 
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  fontWeight: 700,
                  color: colors.text,
                }}>
                  <span style={{ color: colors.accent }}>Kendall</span> is still for <em>You</em>.
                </span>
              </span>
            </button>
            <VideoFrame videoSrc="/landing-page-video.mp4" />
          </div>

          {/* Right: Headline, Bullets, CTA */}
          <div className="order-1 lg:order-2 w-full flex flex-col justify-between lg:pl-0 relative" style={{ paddingLeft: '0', paddingTop: '0', minHeight: '100%' }}>
            <div>
              {/* Headline */}
              <h1 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-light leading-tight tracking-tight"
                style={{ color: colors.text }}
              >
                <span style={{ display: 'block' }}>Missed Calls & No Shows Are Costly.</span>
                <span style={{ display: 'block', marginTop: '1.5rem' }}>
                  Meet{' '}
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
                  </span>.
                </span>
              </h1>

              {/* Bullets */}
              <ul 
                className="space-y-2.5 sm:space-y-4"
                style={{ marginTop: '1.5rem' }}
              >
                <li 
                  className="flex items-start gap-[10px] sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                >
                  <span 
                    className="mt-1 flex-shrink-0"
                    style={{ color: colors.accent }}
                  >
                    •
                  </span>
                  <span className="leading-relaxed">Answers every call instantly</span>
                </li>
                <li 
                  className="flex items-start gap-[10px] sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                >
                  <span 
                    className="mt-1 flex-shrink-0"
                    style={{ color: colors.accent }}
                  >
                    •
                  </span>
                  <span className="leading-relaxed">Confirms, reschedules, and follows up automatically</span>
                </li>
                <li 
                  className="flex items-start gap-[10px] sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                >
                  <span 
                    className="mt-1 flex-shrink-0"
                    style={{ color: colors.accent }}
                  >
                    •
                  </span>
                  <span className="leading-relaxed">Handles customers 24/7</span>
                </li>
                <li 
                  className="flex items-start gap-[10px] sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                >
                  <span 
                    className="mt-1 flex-shrink-0"
                    style={{ color: colors.accent }}
                  >
                    •
                  </span>
                  <span className="leading-relaxed">Updates your calendar</span>
                </li>
                <li 
                  className="flex items-start gap-[10px] sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                >
                  <span 
                    className="mt-1 flex-shrink-0"
                    style={{ color: colors.accent }}
                  >
                    •
                  </span>
                  <span className="leading-relaxed">Collects reviews & maintains post-appointment engagement</span>
                </li>
              </ul>
            </div>

            {/* CTA Button - positioned to align with "Hear Kendall in action" */}
            <div className="flex justify-center" style={{ paddingBottom: '2rem' }}>
              <button
                onClick={scrollToBooking}
                className="group relative flex items-center justify-center overflow-visible w-full sm:w-auto touch-manipulation"
                style={{
                  color: colors.text,
                  backgroundColor: colors.primary,
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '1.125rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), sans-serif',
                  cursor: 'pointer',
                  minWidth: 'auto',
                  minHeight: '52px',
                  transition: 'all 0.3s ease',
                  boxShadow: `0 0 40px rgba(168, 85, 247, 0.7), 0 0 80px rgba(168, 85, 247, 0.5), 0 0 120px rgba(168, 85, 247, 0.3)`, // Purple glow only
                  outline: 'none', // Remove any browser default outline
                  textShadow: 'none', // Remove any text shadow
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 60px rgba(168, 85, 247, 0.9), 0 0 120px rgba(168, 85, 247, 0.7), 0 0 180px rgba(168, 85, 247, 0.5), 0 0 240px rgba(168, 85, 247, 0.3)`; // Enhanced purple glow on hover
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 40px rgba(168, 85, 247, 0.7), 0 0 80px rgba(168, 85, 247, 0.5), 0 0 120px rgba(168, 85, 247, 0.3)`; // Return to default purple glow
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* Animated stars/sparkles */}
                {buttonSparkles.map((sparkle) => {
                  const glowSize = sparkle.intensity > 0.6 ? sparkle.size * 4 : sparkle.size * 2;
                  const glowOpacity = sparkle.intensity > 0.6 ? 0.9 : 0.6;
                  const colorMatch = sparkle.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                  const r = colorMatch ? colorMatch[1] : '255';
                  const g = colorMatch ? colorMatch[2] : '255';
                  const b = colorMatch ? colorMatch[3] : '255';
                  const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
                  const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

                  return (
                    <div
                      key={sparkle.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: `${sparkle.x}%`,
                        top: `${sparkle.y}%`,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        backgroundColor: sparkle.color,
                        opacity: sparkle.opacity,
                        animation: `sparkle-twinkle ${sparkle.duration}s ease-in-out infinite`,
                        animationDelay: `${sparkle.delay}s`,
                        boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
                        zIndex: 1,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  );
                })}
                
                <span style={{ position: 'relative', zIndex: 2, transition: 'all 0.3s ease' }}>
                  <span style={{ fontStyle: 'italic' }}>Feel</span>{' '}
                  <span style={{ 
                    fontFamily: 'var(--font-league-spartan), sans-serif',
                    fontWeight: 700,
                    color: colors.accent,
                  }}>
                    Kendall
                  </span>
                  {' '}in action. → Free Trial
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

