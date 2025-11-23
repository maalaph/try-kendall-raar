'use client';

import { colors, kendallPhoneNumber } from '@/lib/config';

export default function PhoneCTA() {
  if (!kendallPhoneNumber) return null;

  return (
    <section 
      className="relative py-32 sm:py-40 lg:py-48 px-4 sm:px-6 lg:px-8 overflow-hidden"
      style={{ backgroundColor: colors.primary }}
    >
      <div className="relative w-full max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center space-y-16">
          {/* Headline */}
          <div>
            <h2
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-tight tracking-tight"
              style={{ color: colors.text }}
            >
              Hear{' '}
              <span
                style={{
                  color: colors.accent,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  fontWeight: 700,
                }}
              >
                Kendall
              </span>
              {' '}in Action
            </h2>
          </div>

          {/* Premium Phone CTA Block */}
          <div className="w-full max-w-lg pt-4">
            <a
              href={`tel:${kendallPhoneNumber.replace(/\D/g, '')}`}
              className="group relative flex items-center justify-center gap-5 overflow-visible block"
              style={{
                color: colors.text,
                backgroundColor: 'transparent',
                border: `2px solid ${colors.accent}`,
                borderRadius: '12px',
                padding: '1.75rem 2.5rem',
                cursor: 'pointer',
                textDecoration: 'none',
                animation: 'breathe 3s ease-in-out infinite',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.animation = 'none';
                e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}60, 0 0 60px ${colors.accent}40, 0 0 90px ${colors.accent}20`;
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.animation = 'breathe 3s ease-in-out infinite';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Gradient glow background layer */}
              <div 
                className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(135deg, ${colors.accent}15 0%, ${colors.accent}05 100%)`,
                  borderRadius: '12px',
                }}
              />

              {/* Phone icon with glow */}
              <div className="relative flex-shrink-0">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: colors.accent }}
                  className="relative z-10 transition-transform duration-300 group-hover:scale-110"
                >
                  <path
                    d="M3 5C3 3.89543 3.89543 3 5 3H8.27924C8.70967 3 9.09181 3.27543 9.22792 3.68377L10.7257 8.17721C10.8831 8.64932 10.6694 9.16531 10.2243 9.38787L7.96701 10.5165C9.06925 12.9612 11.0388 14.9308 13.4835 16.033L14.6121 13.7757C14.8347 13.3306 15.3507 13.1169 15.8228 13.2743L20.3162 14.7721C20.7246 14.9082 21 15.2903 21 15.7208V19C21 20.1046 20.1046 21 19 21H18C9.71573 21 3 14.2843 3 6V5Z"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {/* Subtle pulsing glow around icon */}
                <div
                  className="absolute inset-0 rounded-full -z-10"
                  style={{
                    background: `radial-gradient(circle, ${colors.accent}40 0%, transparent 70%)`,
                    animation: 'pulse-glow 2s ease-in-out infinite',
                    transform: 'scale(1.8)',
                    margin: '-9px',
                  }}
                />
              </div>
              
              {/* Phone number - bold and prominent */}
              <span 
                className="relative z-10"
                style={{ 
                  fontSize: '1.875rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                {kendallPhoneNumber}
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

