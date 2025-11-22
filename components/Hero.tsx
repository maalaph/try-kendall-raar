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
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">
          {/* Left: Video Frame */}
          <div className="order-2 lg:order-1 w-full flex items-center" style={{ maxWidth: '100%', marginRight: '-6rem', marginLeft: '-4rem' }}>
            <VideoFrame />
          </div>

          {/* Right: Headline, Bullets, CTA */}
          <div className="order-1 lg:order-2 w-full flex flex-col justify-center" style={{ paddingLeft: '4rem' }}>
            {/* Headline */}
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight tracking-tight"
              style={{ color: colors.text }}
            >
              <span>Missed Calls & No Shows Are Costly.</span>
              <span style={{ display: 'block', marginTop: '1.25rem' }}>
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
              className="space-y-2.5 sm:space-y-3"
              style={{ marginTop: '2rem' }}
            >
              <li 
                className="flex items-start gap-2.5 text-base sm:text-lg font-light"
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
                className="flex items-start gap-2.5 text-base sm:text-lg font-light"
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
                className="flex items-start gap-2.5 text-base sm:text-lg font-light"
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
                className="flex items-start gap-2.5 text-base sm:text-lg font-light"
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
                className="flex items-start gap-2.5 text-base sm:text-lg font-light"
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
            <div className="flex justify-center" style={{ marginTop: '2.5rem' }}>
              <button
                onClick={scrollToBooking}
                className="group relative flex items-center justify-center overflow-hidden"
                style={{
                  color: colors.text,
                  backgroundColor: 'transparent',
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '1rem 2.5rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), sans-serif',
                  cursor: 'pointer',
                  minWidth: '220px',
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

