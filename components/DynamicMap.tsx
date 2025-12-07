'use client';

/**
 * Dynamic Map Component
 * Wraps InteractiveMap with dynamic import to prevent SSR issues
 */

import dynamic from 'next/dynamic';
import { colors } from '@/lib/config';

// Dynamically import the map component with no SSR
const InteractiveMap = dynamic(
  () => import('./InteractiveMap'),
  { 
    ssr: false,
    loading: () => (
      <div 
        className="rounded-xl overflow-hidden animate-pulse flex items-center justify-center"
        style={{ 
          height: '300px',
          background: `linear-gradient(135deg, ${colors.primary}80, ${colors.secondary})`,
        }}
      >
        <div className="flex items-center gap-2" style={{ color: colors.text, opacity: 0.6 }}>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading map...</span>
        </div>
      </div>
    ),
  }
);

export default InteractiveMap;

// Also export named for flexibility
export { InteractiveMap as DynamicMap };

