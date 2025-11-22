'use client';

import { InlineWidget } from 'react-calendly';
import { colors } from '@/lib/config';

export default function CalendarEmbed() {
  // Remove # from hex colors for Calendly pageSettings
  const calendlyBgColor = colors.secondary.replace('#', '');
  const calendlyTextColor = colors.text.replace('#', '');
  const calendlyPrimaryColor = colors.accent.replace('#', '');

  // Get Calendly URL from environment variable or use default
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/admin-ordco/15';

  return (
    <div
      data-calendar-embed
      className="w-full flex items-center justify-center"
      style={{
        backgroundColor: colors.secondary,
        minHeight: '600px sm:700px',
        padding: '1rem sm:2rem',
      }}
    >
      <div className="w-full max-w-4xl" style={{ height: '100%' }}>
        <InlineWidget
          url={calendlyUrl}
          styles={{
            height: '600px',
            minHeight: '600px',
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

