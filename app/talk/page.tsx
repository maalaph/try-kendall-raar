'use client';

import { useState, useEffect } from 'react';
import CalendarEmbed from '@/components/CalendarEmbed';
import { colors, heroContent } from '@/lib/config';

export default function TalkPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: colors.primary }}>
      <div
        className="w-full min-h-screen flex flex-col items-center justify-center"
        style={{ padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 8rem)' }}
      >
        {/* Bullet Points */}
        <div className="w-full flex flex-col items-center mb-12" style={{ maxWidth: '600px' }}>
          <h2
            style={{
              color: colors.text,
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 300,
              fontFamily: 'var(--font-inter), sans-serif',
              textAlign: 'center',
              marginBottom: '2rem',
            }}
          >
            Get your personalized Kendall demo
          </h2>
          <ul className="flex flex-col gap-3 sm:gap-4 w-full">
            {heroContent.right.bullets.map((bullet, index) => (
              <li 
                key={index}
                className="flex items-start gap-3"
                style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6', fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)' }}
              >
                <span 
                  className="mt-1 flex-shrink-0"
                  style={{ color: colors.accent, fontSize: '1.25rem' }}
                >
                  •
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Calendar - Only render on client */}
        {isClient && (
          <div className="w-full" style={{ maxWidth: '900px' }}>
            <CalendarEmbed />
          </div>
        )}
      </div>
    </main>
  );
}

