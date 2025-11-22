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
      className="w-full h-full min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]"
      style={{ 
        backgroundColor: colors.secondary,
      }}
    >
      <InlineWidget 
        url="https://calendly.com/admin-ordco/30min"
        styles={{
          height: '100%',
          minHeight: '400px',
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
  );
}

