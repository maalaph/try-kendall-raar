'use client';

import VideoFrame from './VideoFrame';
import { heroContent, colors, kendallPhoneNumber } from '@/lib/config';

export default function Hero() {
  const scrollToBooking = () => {
    const bookingSection = document.getElementById('booking-section');
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-40 pb-8 sm:pb-16 lg:pb-20">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-48 items-start">
          {/* Left: Video Frame */}
          <div className="order-2 lg:order-1 w-full flex flex-col items-center lg:pr-0" style={{ maxWidth: '100%', marginRight: '0', marginLeft: '0' }}>
            <VideoFrame />
          </div>

          {/* Right: Headline, Bullets, CTA */}
          <div className="order-1 lg:order-2 w-full flex flex-col justify-start lg:pl-0" style={{ paddingLeft: '0', paddingTop: '0' }}>
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

            {/* CTA Button */}
            <div className="flex justify-center" style={{ marginTop: '1.5rem' }}>
              <button
                onClick={scrollToBooking}
                className="group relative flex items-center justify-center overflow-hidden w-full sm:w-auto touch-manipulation"
                style={{
                  color: colors.text,
                  backgroundColor: 'transparent',
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, transition: 'all 0.3s ease' }}>
                  Feel{' '}
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

