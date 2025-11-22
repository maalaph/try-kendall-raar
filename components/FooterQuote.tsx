'use client';

import { colors, config } from '@/lib/config';

export default function FooterQuote() {
  return (
    <footer 
      className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t"
      style={{ 
        borderColor: colors.secondary,
        backgroundColor: colors.primary,
      }}
    >
      <div className="w-full max-w-7xl mx-auto text-center space-y-4" style={{ margin: '0 auto' }}>
        <p 
          className="text-base sm:text-lg font-light italic"
          style={{ 
            color: colors.text, 
            opacity: 0.7,
            fontFamily: 'Times New Roman, Times, serif'
          }}
        >
          Play long term games with long term people.
        </p>
        <p 
          className="text-xs sm:text-sm font-light"
          style={{ color: 'rgba(255, 255, 255, 0.6)' }}
        >
          Contact: admin@ordco.net
        </p>
      </div>
    </footer>
  );
}

