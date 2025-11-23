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
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
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
              style={{
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}
            >
              Kendall
            </span>
            {' '}For Free.
          </h2>
        </div>

        {/* Meeting Details */}
        <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 px-4">
          <div className="flex items-center gap-2" style={{ color: colors.text }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: colors.text }}
            >
              <path
                d="M8 0C3.589 0 0 3.589 0 8s3.589 8 8 8 8-3.589 8-8-3.589-8-8-8zm0 14c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6z"
                fill="currentColor"
              />
              <path
                d="M8.5 4H7v4.5l3.5 2.1.8-1.3-3.2-1.9V4z"
                fill="currentColor"
              />
            </svg>
            <span className="text-sm sm:text-base font-light">15 min</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: colors.text }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: colors.text }}
            >
              <path
                d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"
                fill="currentColor"
              />
              <path
                d="M2 3h12v1H2V3zm0 2h12v1H2V5zm0 2h8v1H2V7zm0 2h12v1H2V9zm0 2h12v1H2v-1zm0 2h8v1H2v-1z"
                fill="currentColor"
              />
            </svg>
            <span className="text-sm sm:text-base font-light">
              Meeting information provided upon booking.
            </span>
          </div>
        </div>

        {/* Calendar only - centered and full width */}
        <div className="w-full mt-8 sm:mt-12">
          <CalendarEmbed onEventScheduled={handleEventScheduled} />
        </div>
      </div>
    </section>
    </>
  );
}

