'use client';

import { useState } from 'react';
import CalendarEmbed from './CalendarEmbed';
import Fireworks from './Fireworks';
import { bookingContent, colors, kendallPhoneNumber } from '@/lib/config';

export default function BookingSection() {
  const [showFireworks, setShowFireworks] = useState(false);

  const handleEventScheduled = () => {
    setShowFireworks(true);
  };

  return (
    <>
      <Fireworks trigger={showFireworks} onComplete={() => setShowFireworks(false)} />
      <section
      id="booking-section"
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24 py-12 sm:py-16 md:py-20 lg:py-24"
    >
      <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 md:space-y-12">
        {/* Headline */}
        <div className="text-center px-4">
          <h2
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-light tracking-tight"
            style={{ color: colors.text }}
          >
            Try{' '}
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
            {' '}For Free.
          </h2>
        </div>

        {/* Calendar only - centered and full width */}
        <div className="w-full mt-8 sm:mt-12 md:mt-16 lg:mt-20">
          <CalendarEmbed onEventScheduled={handleEventScheduled} />
        </div>
      </div>
    </section>
    </>
  );
}

