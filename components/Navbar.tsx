'use client';

import { colors } from '@/lib/config';

export default function Navbar() {
  return (
    <nav 
      className="absolute top-0 z-50"
      style={{
        left: '3rem',
        paddingTop: '1.5rem',
      }}
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

