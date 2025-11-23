'use client';

import { useEffect } from 'react';
import { InlineWidget } from 'react-calendly';
import { colors } from '@/lib/config';

interface CalendarEmbedProps {
  onEventScheduled?: () => void;
}

export default function CalendarEmbed({ onEventScheduled }: CalendarEmbedProps) {
  // Remove # from hex colors for Calendly pageSettings
  const calendlyBgColor = colors.primary.replace('#', ''); // Use pure black instead of gray
  const calendlyTextColor = colors.text.replace('#', '');
  const calendlyPrimaryColor = colors.accent.replace('#', '');

  // Get Calendly URL from environment variable or use default
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/admin-ordco/15';

  // Listen for Calendly events
  useEffect(() => {
    const handleCalendlyEvent = (e: MessageEvent) => {
      if (e.data.event && e.data.event.indexOf('calendly') === 0) {
        if (e.data.event === 'calendly.event_scheduled' || e.data.event === 'calendly.event_type_viewed') {
          // Trigger fireworks when event is scheduled
          if (e.data.event === 'calendly.event_scheduled' && onEventScheduled) {
            onEventScheduled();
          }
        }
      }
    };

    window.addEventListener('message', handleCalendlyEvent);
    return () => {
      window.removeEventListener('message', handleCalendlyEvent);
    };
  }, [onEventScheduled]);

  // Inject custom CSS to make Calendly blend seamlessly
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Hide Calendly borders and containers - seamless dark theme */
      [data-calendar-embed] .calendly-inline-widget {
        background: ${colors.primary} !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      
      /* Remove any white/gray backgrounds */
      .calendly-inline-widget {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      
      /* Make Calendly iframe blend in */
      .calendly-inline-widget iframe {
        background: ${colors.primary} !important;
        border: none !important;
      }
      
      /* Remove scrollbars - make it flow naturally with full height */
      .calendly-inline-widget {
        overflow: hidden !important;
        height: 1200px !important;
        min-height: 1200px !important;
      }
      
      /* Ensure iframe takes full height without internal scroll */
      .calendly-inline-widget iframe {
        height: 1200px !important;
        min-height: 1200px !important;
        overflow: hidden !important;
      }
      
      /* Specific override for Calendly's wrapper divs */
      [data-calendar-embed] > div {
        background: ${colors.primary} !important;
      }
      
      /* Ensure no borders or shadows on wrapper */
      [data-calendar-embed] > div > div {
        background: ${colors.primary} !important;
        border: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [colors.primary]);

  return (
    <div
      data-calendar-embed
      className="w-full flex items-center justify-center"
      style={{
        backgroundColor: colors.primary, // Pure black to match page
        padding: 0,
        marginTop: '3rem',
      }}
    >
      <div className="w-full max-w-5xl">
        <InlineWidget
          url={calendlyUrl}
          styles={{
            height: '1200px', // Full height to show entire calendar without internal scrolling
            minHeight: '1200px',
            width: '100%',
            display: 'block',
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

