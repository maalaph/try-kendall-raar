'use client';

import VideoFrame from './VideoFrame';
import { heroContent, colors } from '@/lib/config';

export default function Hero() {
  const scrollToBooking = () => {
    const bookingSection = document.getElementById('booking-section');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center py-12 sm:py-16 md:py-20 lg:py-24" style={{ paddingLeft: 'clamp(1rem, 5vw, 6rem)', paddingRight: 'clamp(1rem, 5vw, 6rem)' }}>
      <div className="w-full mx-auto" style={{ maxWidth: 'clamp(1200px, 90vw, 1600px)' }}>
        <div className="grid grid-cols-2 items-end" style={{ gap: 'clamp(4rem, 12vw, 12rem)' }}>
          {/* Left: Video Frame */}
          <div className="w-full flex items-center" style={{ maxWidth: '100%', paddingRight: 'clamp(1rem, 3vw, 2rem)' }}>
            <VideoFrame videoSrc="/landing-page-video.mp4" />
          </div>

          {/* Right: Headline, Bullets, CTA */}
          <div className="w-full flex flex-col justify-start relative" style={{ paddingLeft: 'clamp(1rem, 3vw, 2rem)', paddingTop: '0', minHeight: '100%' }}>
            {/* Headline */}
            <h1 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-light leading-tight tracking-tight"
              style={{ color: colors.text }}
            >
              <span style={{ 
                display: 'block',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5), 0 4px 20px rgba(0, 0, 0, 0.3)'
              }}>Missed Calls & No Shows Are Costly.</span>
              <span style={{ 
                display: 'block', 
                marginTop: '1.5rem',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
              }}>
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
                style={{ 
                  color: colors.text, 
                  opacity: 0.9, 
                  lineHeight: '1.6',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                }}
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
                style={{ 
                  color: colors.text, 
                  opacity: 0.9, 
                  lineHeight: '1.6',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                }}
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
                style={{ 
                  color: colors.text, 
                  opacity: 0.9, 
                  lineHeight: '1.6',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                }}
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
                style={{ 
                  color: colors.text, 
                  opacity: 0.9, 
                  lineHeight: '1.6',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                }}
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
                style={{ 
                  color: colors.text, 
                  opacity: 0.9, 
                  lineHeight: '1.6',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)'
                }}
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

            {/* CTA Button */}
            <div className="flex justify-center absolute bottom-0 left-0 right-0" style={{ bottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
              <button
                onClick={scrollToBooking}
                className="group relative flex items-center justify-center overflow-hidden w-full sm:w-auto touch-manipulation"
                style={{
                  color: colors.text,
                  backgroundColor: `${colors.accent}15`,
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
                  boxShadow: `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`,
                  transform: 'scale(1.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 60px ${colors.accent}90, 0 0 120px ${colors.accent}70, 0 0 160px ${colors.accent}50`;
                  e.currentTarget.style.transform = 'scale(1.15)';
                  e.currentTarget.style.backgroundColor = `${colors.accent}25`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.backgroundColor = `${colors.accent}15`;
                }}
              >
                <span style={{ 
                  position: 'relative', 
                  zIndex: 1, 
                  transition: 'all 0.3s ease',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                }}>
                  <span style={{ fontStyle: 'italic' }}>Feel</span>{' '}
                  <span 
                    className="kendall-glow"
                    style={{ 
                      fontFamily: 'var(--font-league-spartan), sans-serif',
                      fontWeight: 700,
                      color: colors.accent,
                      opacity: 0.75,
                      display: 'inline-block',
                    }}
                  >
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

