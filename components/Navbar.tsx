'use client';

import { colors } from '@/lib/config';

export default function Navbar() {
  return (
    <nav 
      className="absolute top-0 left-0 z-50"
      className="pt-4 sm:pt-6 pl-5 sm:pl-8"
    >
      <a
        href="/"
        className="inline-block transition-all duration-300"
        style={{
          fontFamily: 'var(--font-league-spartan), sans-serif',
          fontSize: 'clamp(32px, 8vw, 60px)',
          color: colors.text,
          textDecoration: 'none',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textShadow = `0 0 20px ${colors.accent}33`; // 33 hex = ~20% opacity
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textShadow = 'none';
        }}
      >
        raar.
      </a>
    </nav>
  );
}

