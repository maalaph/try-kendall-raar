'use client';

import CalendarEmbed from './CalendarEmbed';
import { bookingContent, colors } from '@/lib/config';

export default function BookingSection() {
  return (
    <section
      id="booking-section"
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
    >
      <div className="w-full max-w-7xl mx-auto space-y-8 sm:space-y-12">
        {/* Headline */}
        <div className="text-center px-4">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light tracking-tight"
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

        {/* Calendar only - centered and full width */}
        <div
          className="w-full"
          style={{ marginTop: '3rem' }}
        >
          <CalendarEmbed />
        </div>
      </div>
    </section>
  );
}

