'use client';

import { useState, useEffect } from 'react';
import { colors, kendallPhoneNumber } from '@/lib/config';
import Link from 'next/link';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  intensity: number;
  color: string;
}

export default function Navbar() {
  const [personalButtonStars, setPersonalButtonStars] = useState<Sparkle[]>([]);

  useEffect(() => {
    // Create stars for the personal button
    const sparkleColors = [
      { bg: 'rgba(255, 255, 255, 1)', glow: 'rgba(255, 255, 255, 0.9)' }, // White
      { bg: 'rgba(168, 85, 247, 1)', glow: 'rgba(168, 85, 247, 0.9)' }, // Purple
      { bg: 'rgba(192, 132, 252, 1)', glow: 'rgba(192, 132, 252, 0.9)' }, // Light purple
    ];

    const personalStars: Sparkle[] = Array.from({ length: 25 }, (_, i) => {
      const intensity = Math.random();
      const isBright = intensity > 0.6;
      const colorIndex = Math.floor(Math.random() * sparkleColors.length);
      const starColor = sparkleColors[colorIndex];

      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isBright ? Math.random() * 1.5 + 0.8 : Math.random() * 1 + 0.5,
        opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        intensity: intensity,
        color: starColor.bg,
      };
    });
    setPersonalButtonStars(personalStars);
  }, []);

  const scrollToPersonal = () => {
    const personalSection = document.getElementById('kendall-personal-hero');
    if (personalSection) {
      window.location.hash = 'kendall-personal-hero';
      personalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav 
      className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ 
        padding: 'clamp(1rem, 2.5vw, 2rem) clamp(2rem, 8vw, 10rem)'
      }}
    >
      {/* All items evenly spaced: Raar | Talk to Us | CTA | Pricing | Call Kendall */}
      <div className="w-full flex items-center justify-between">
        {/* 1. Raar logo */}
        <Link
          href="/"
          className="inline-block transition-all duration-300 flex-shrink-0"
          style={{
            fontFamily: 'var(--font-league-spartan), sans-serif',
            fontSize: 'clamp(24px, 6vw, 60px)',
            color: colors.text,
            textDecoration: 'none',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textShadow = `0 0 20px ${colors.accent}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textShadow = 'none';
          }}
        >
          raar.
        </Link>

        {/* 2. Talk to Us */}
        <Link
          href="/talk"
          className="transition-all duration-300 flex-shrink-0"
          style={{
            color: colors.text,
            textDecoration: 'none',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textShadow = `0 0 20px ${colors.accent}50`;
            e.currentTarget.style.color = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textShadow = 'none';
            e.currentTarget.style.color = colors.text;
          }}
        >
          Talk to Us
        </Link>

        {/* 3. CTA button - in the middle */}
        <button
          onClick={scrollToPersonal}
          className="group relative flex items-center justify-center overflow-visible touch-manipulation flex-shrink-0"
          style={{
            color: colors.text,
            backgroundColor: `${colors.accent}15`,
            border: `2.5px solid ${colors.accent}`,
            borderRadius: '14px',
            padding: '1rem 2rem',
            fontSize: 'clamp(0.875rem, 1.8vw, 1rem)',
            fontWeight: 600,
            fontFamily: 'var(--font-inter), sans-serif',
            cursor: 'pointer',
            minHeight: '52px',
            transition: 'all 0.3s ease',
            boxShadow: `0 0 30px ${colors.accent}40, 0 0 60px ${colors.accent}25, 0 0 90px ${colors.accent}15`,
            outline: 'none',
            textShadow: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 45px ${colors.accent}60, 0 0 90px ${colors.accent}40, 0 0 135px ${colors.accent}25`;
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.backgroundColor = `${colors.accent}20`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}40, 0 0 60px ${colors.accent}25, 0 0 90px ${colors.accent}15`;
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
          }}
        >
          {/* Background Stars */}
          {personalButtonStars.map((star) => {
            const glowSize = star.intensity > 0.6 ? star.size * 3 : star.size * 2;
            const glowOpacity = star.intensity > 0.6 ? 0.7 : 0.5;
            const colorMatch = star.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            const r = colorMatch ? colorMatch[1] : '255';
            const g = colorMatch ? colorMatch[2] : '255';
            const b = colorMatch ? colorMatch[3] : '255';
            const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
            const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

            return (
              <div
                key={star.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  backgroundColor: star.color,
                  opacity: star.opacity,
                  animation: `sparkle-twinkle ${star.duration}s ease-in-out infinite`,
                  animationDelay: `${star.delay}s`,
                  boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
                  zIndex: 1,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
          <span style={{ position: 'relative', zIndex: 2 }}>
            Not a Business?{' '}
            <span style={{ 
              fontFamily: 'var(--font-league-spartan), sans-serif',
              fontWeight: 700,
              color: colors.text,
            }}>
              <span style={{ color: colors.text }}>My</span><span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span> is for <em>you</em>.
            </span>
          </span>
        </button>

        {/* 4. Pricing */}
        <Link
          href="/pricing"
          className="transition-all duration-300 flex-shrink-0"
          style={{
            color: colors.text,
            textDecoration: 'none',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textShadow = `0 0 20px ${colors.accent}50`;
            e.currentTarget.style.color = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textShadow = 'none';
            e.currentTarget.style.color = colors.text;
          }}
        >
          Pricing
        </Link>

        {/* 5. Call Kendall */}
        {kendallPhoneNumber && (
          <a
            href={`tel:${kendallPhoneNumber.replace(/\D/g, '')}`}
            className="group flex items-center gap-2 sm:gap-3 lg:gap-3 transition-all duration-300 px-5 py-2 sm:px-6 sm:py-2 lg:px-10 lg:py-3.5 text-base sm:text-lg lg:text-xl flex-shrink-0"
            style={{
              color: colors.text,
              backgroundColor: `${colors.accent}15`,
              border: 'none',
              borderRadius: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-inter), sans-serif',
              textDecoration: 'none',
              minHeight: '44px',
              minWidth: '220px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = `${colors.accent}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            }}
          >
            <svg
              width="24"
              height="24"
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
                  color: colors.accent,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  fontWeight: 700,
                  display: 'inline-block',
                }}
              >
                Kendall
              </span>
              {' '} {kendallPhoneNumber}
            </span>
            <span className="sm:hidden">Call</span>
          </a>
        )}
      </div>
    </nav>
  );
}

