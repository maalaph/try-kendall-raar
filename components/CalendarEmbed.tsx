'use client';

import { InlineWidget } from 'react-calendly';
import { colors } from '@/lib/config';

export default function CalendarEmbed() {
  // Remove # from hex colors for Calendly pageSettings
  const calendlyBgColor = colors.secondary.replace('#', '');
  const calendlyTextColor = colors.text.replace('#', '');
  const calendlyPrimaryColor = colors.accent.replace('#', '');

  return (
    <div
      data-calendar-embed
      className="w-full flex items-center justify-center"
      style={{
        backgroundColor: colors.secondary,
        minHeight: '700px',
        padding: '2rem',
      }}
    >
      <div className="w-full max-w-4xl" style={{ height: '100%' }}>
        <InlineWidget
          url="https://calendly.com/admin-ordco/15"
          styles={{
            height: '700px',
            width: '100%',
          }}
          pageSettings={{
            backgroundColor: calendlyBgColor,
            hideEventTypeDetails: false,
            hideLandingPageDetails: false,
            primaryColor: calendlyPrimaryColor,
            textColor: calendlyTextColor,
          }}
        />
      </div>
    </div>
  );
}

