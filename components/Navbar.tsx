'use client';

import { colors, kendallPhoneNumber } from '@/lib/config';

export default function Navbar() {
  return (
    <nav 
      className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center"
      className="px-4 sm:px-6 lg:px-12"
      style={{
        paddingTop: '1.25rem',
        paddingBottom: '1.25rem',
      }}
    >
      <a
        href="/"
        className="inline-block transition-all duration-300"
        style={{
          fontFamily: 'var(--font-league-spartan), sans-serif',
          fontSize: 'clamp(24px, 6vw, 60px)',
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

      {/* Phone CTA in Navbar */}
      {kendallPhoneNumber && (
        <a
          href={`tel:${kendallPhoneNumber.replace(/\D/g, '')}`}
          className="group flex items-center gap-2 sm:gap-3 transition-all duration-300"
          style={{
            color: colors.text,
            backgroundColor: `${colors.accent}15`,
            border: `2px solid ${colors.accent}`,
            borderRadius: '12px',
            padding: '0.875rem 1.25rem',
            fontSize: '0.95rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            textDecoration: 'none',
            boxShadow: `0 0 15px ${colors.accent}30`,
            minHeight: '48px', // iOS touch target minimum
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.backgroundColor = `${colors.accent}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 15px ${colors.accent}30`;
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: colors.accent }}
            className="flex-shrink-0"
          >
            <path
              d="M3 5C3 3.89543 3.89543 3 5 3H8.27924C8.70967 3 9.09181 3.27543 9.22792 3.68377L10.7257 8.17721C10.8831 8.64932 10.6694 9.16531 10.2243 9.38787L7.96701 10.5165C9.06925 12.9612 11.0388 14.9308 13.4835 16.033L14.6121 13.7757C14.8347 13.3306 15.3507 13.1169 15.8228 13.2743L20.3162 14.7721C20.7246 14.9082 21 15.2903 21 15.7208V19C21 20.1046 20.1046 21 19 21H18C9.71573 21 3 14.2843 3 6V5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:inline">
            <span
              style={{
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
                color: colors.accent,
              }}
            >
              Kendall
            </span>
            {' '}: {kendallPhoneNumber}
          </span>
          <span className="sm:hidden">Call</span>
        </a>
      )}
    </nav>
  );
}

