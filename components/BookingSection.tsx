'use client';

import Form from './Form';
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

        {/* Form + Calendar side-by-side layout */}
        <div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12"
          style={{ marginTop: '3rem' }}
        >
          {/* Left: Form */}
          <div className="order-2 lg:order-1 w-full">
            <Form />
          </div>

          {/* Right: Calendar Embed */}
          <div className="order-1 lg:order-2 w-full">
            <CalendarEmbed />
          </div>
        </div>
      </div>
    </section>
  );
}

