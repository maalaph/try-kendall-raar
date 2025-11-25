'use client';

import { useEffect, useState } from 'react';
import CalendarEmbed from './CalendarEmbed';
import { colors } from '@/lib/config';

export default function WizardSidePanel() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div
      className="w-full flex flex-col items-center"
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        zIndex: 20,
        padding: 0,
        margin: 0,
      }}
    >
      <h3
        className="text-xl sm:text-2xl md:text-3xl font-light tracking-tight text-center"
        style={{ color: colors.text, marginBottom: '2rem' }}
      >
        Want to talk to us?
      </h3>

      <ul className="space-y-4 text-center" style={{ listStyle: 'none', padding: 0, marginBottom: '4rem' }}>
        <li className="flex items-start justify-center gap-3">
          <span style={{ color: colors.accent, marginTop: '0.25rem' }}>•</span>
          <span style={{ color: colors.text, opacity: 0.9, fontFamily: 'var(--font-inter), sans-serif' }}>
            We explain exactly how Kendall works for your business
          </span>
        </li>
        <li className="flex items-start justify-center gap-3">
          <span style={{ color: colors.accent, marginTop: '0.25rem' }}>•</span>
          <span style={{ color: colors.text, opacity: 0.9, fontFamily: 'var(--font-inter), sans-serif' }}>
            We help you identify other areas where you're losing time & money
          </span>
        </li>
        <li className="flex items-start justify-center gap-3">
          <span style={{ color: colors.accent, marginTop: '0.25rem' }}>•</span>
          <span style={{ color: colors.text, opacity: 0.9, fontFamily: 'var(--font-inter), sans-serif' }}>
            We show you how our systems can solve your problems
          </span>
        </li>
      </ul>

      {isClient && (
        <div className="w-full" style={{ marginTop: '4rem' }}>
          <CalendarEmbed />
        </div>
      )}
    </div>
  );
}

