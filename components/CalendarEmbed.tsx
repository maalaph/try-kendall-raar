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
  // Add embed_domain and embed_type parameters to help control height
  const baseUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/admin-ordco/15';
  const calendlyUrl = `${baseUrl}?embed_domain=${typeof window !== 'undefined' ? window.location.hostname : ''}&embed_type=Inline`;

  // Listen for Calendly events and prevent iframe resizing
  useEffect(() => {
    const handleCalendlyEvent = (e: MessageEvent) => {
      if (e.data.event && e.data.event.indexOf('calendly') === 0) {
        if (e.data.event === 'calendly.event_scheduled' || e.data.event === 'calendly.event_type_viewed') {
          // Trigger fireworks when event is scheduled
          if (e.data.event === 'calendly.event_scheduled' && onEventScheduled) {
            onEventScheduled();
          }
        }
        
        // Prevent Calendly from resizing the iframe
        if (e.data.event === 'calendly.event_type_viewed' || e.data.event === 'calendly.date_selected') {
          // Force iframe to stay at fixed height
          const iframe = document.querySelector('[data-calendar-embed] iframe') as HTMLIFrameElement;
          if (iframe) {
            iframe.style.height = '800px';
            iframe.style.minHeight = '800px';
            iframe.style.maxHeight = '800px';
          }
        }
      }
      
      // Block any height change requests from Calendly
      if (e.data.type === 'calendly-height-change' || e.data.height) {
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('message', handleCalendlyEvent, true);
    return () => {
      window.removeEventListener('message', handleCalendlyEvent, true);
    };
  }, [onEventScheduled]);

  // Force iframe to stay fixed height on mount and after any changes
  useEffect(() => {
    const enforceFixedHeight = () => {
      const iframe = document.querySelector('[data-calendar-embed] iframe') as HTMLIFrameElement;
      if (iframe) {
        iframe.style.height = '800px';
        iframe.style.minHeight = '800px';
        iframe.style.maxHeight = '800px';
      }
    };

    // Enforce on mount
    enforceFixedHeight();

    // Set up observer to watch for iframe changes
    const observer = new MutationObserver(enforceFixedHeight);
    const container = document.querySelector('[data-calendar-embed]');
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'height'],
      });
    }

    // Also check periodically (fallback)
    const interval = setInterval(enforceFixedHeight, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  // Inject custom CSS to make Calendly blend seamlessly and fix scrolling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Hide Calendly borders and containers - seamless dark theme */
      [data-calendar-embed] .calendly-inline-widget {
        background: transparent !important;
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
        outline: none !important;
      }
      
      /* Make Calendly iframe blend in */
      .calendly-inline-widget iframe {
        background: transparent !important;
        border: none !important;
        outline: none !important;
      }
      
      /* Specific override for Calendly's wrapper divs */
      [data-calendar-embed] > div {
        background: transparent !important;
        border: none !important;
        outline: none !important;
      }
      
      /* Ensure no borders or shadows on wrapper */
      [data-calendar-embed] > div > div {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
      
      /* Fix calendar scrolling - STRICT fixed height, no expansion allowed */
      [data-calendar-embed] {
        position: relative !important;
        overflow: hidden !important;
        height: 800px !important;
        min-height: 800px !important;
        max-height: 800px !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: center !important;
      }
      
      [data-calendar-embed] > div {
        height: 800px !important;
        min-height: 800px !important;
        max-height: 800px !important;
        overflow: hidden !important;
        width: 100% !important;
        position: relative !important;
      }
      
      [data-calendar-embed] > div > div {
        height: 800px !important;
        min-height: 800px !important;
        max-height: 800px !important;
        overflow: hidden !important;
      }
      
      .calendly-inline-widget {
        height: 800px !important;
        min-height: 800px !important;
        max-height: 800px !important;
        overflow: hidden !important;
        position: relative !important;
      }
      
      .calendly-inline-widget iframe {
        height: 800px !important;
        min-height: 800px !important;
        max-height: 800px !important;
        width: 100% !important;
        border: none !important;
        display: block !important;
        position: relative !important;
        overflow: hidden !important;
        flex-shrink: 0 !important;
      }
      
      /* Prevent Calendly from resizing the iframe */
      .calendly-inline-widget iframe {
        pointer-events: auto !important;
        resize: none !important;
      }
      
      /* Override any Calendly auto-resize scripts */
      [data-calendar-embed] * {
        max-height: 800px !important;
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
        backgroundColor: 'transparent',
        padding: 0,
        marginTop: 0,
        position: 'relative',
      }}
    >
      <div 
        className="w-full"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          height: '800px',
          minHeight: '800px',
          maxHeight: '800px',
        }}
      >
        <div
          style={{
            height: '800px',
            minHeight: '800px',
            maxHeight: '800px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <InlineWidget
            url={calendlyUrl}
            styles={{
              height: '800px',
              minHeight: '800px',
              maxHeight: '800px',
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
    </div>
  );
}

