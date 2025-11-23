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
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-24 items-center">
          {/* Left: Video Frame */}
          <div className="order-2 lg:order-1 w-full flex items-center lg:pr-0" style={{ maxWidth: '100%', marginRight: '0', marginLeft: '0' }}>
            <VideoFrame />
          </div>

          {/* Right: Headline, Bullets, CTA */}
          <div className="order-1 lg:order-2 w-full flex flex-col justify-center lg:pl-8" style={{ paddingLeft: '0', paddingTop: '-1rem' }}>
            {/* Headline */}
            <h1 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-light leading-tight tracking-tight"
              style={{ color: colors.text }}
            >
              <span style={{ display: 'block' }}>Missed Calls & No Shows Are Costly.</span>
              <span style={{ display: 'block', marginTop: '6rem sm:7rem' }}>
                Meet{' '}
                <span 
                  style={{ 
                    color: colors.accent,
                    fontFamily: 'var(--font-league-spartan), sans-serif',
                    fontWeight: 700,
                  }}
                >
                  Kendall
                </span>.
              </span>
            </h1>

            {/* Bullets */}
            <ul 
              className="space-y-3 sm:space-y-4"
              style={{ marginTop: '5rem sm:6rem' }}
            >
              <li 
                className="flex items-start gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                style={{ color: colors.text, opacity: 0.9 }}
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
                className="flex items-start gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                style={{ color: colors.text, opacity: 0.9 }}
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
                className="flex items-start gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                style={{ color: colors.text, opacity: 0.9 }}
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
                className="flex items-start gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                style={{ color: colors.text, opacity: 0.9 }}
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
                className="flex items-start gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-light"
                style={{ color: colors.text, opacity: 0.9 }}
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
            <div className="flex justify-center" style={{ marginTop: '2rem' }}>
              <button
                onClick={scrollToBooking}
                className="group relative flex items-center justify-center overflow-hidden w-full sm:w-auto"
                style={{
                  color: colors.text,
                  backgroundColor: 'transparent',
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '0.875rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), sans-serif',
                  cursor: 'pointer',
                  minWidth: 'auto',
                  animation: 'breathe 3s ease-in-out infinite',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.animation = 'none';
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}60, 0 0 40px ${colors.accent}40`;
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.animation = 'breathe 3s ease-in-out infinite';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, transition: 'all 0.3s ease' }}>
                  Your move → Try{' '}
                  <span style={{ 
                    fontFamily: 'var(--font-league-spartan), sans-serif',
                    fontWeight: 700,
                    color: colors.accent,
                  }}>
                    Kendall
                  </span>
                  {' '}For Free.
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

