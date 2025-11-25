'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { Briefcase, Megaphone, Phone, Sparkles, Shield, Zap } from 'lucide-react';
import SimpleDot from './SimpleDot';

const BUY_PERSONAL_URL = process.env.NEXT_PUBLIC_KENDALL_PERSONAL_URL || 'https://buy.stripe.com/cNi14n8968x6gOB8LocQU00';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  color: string;
}

export default function KendallPersonalHero() {
  const [stars, setStars] = useState<Star[]>([]);
  const [backgroundStars, setBackgroundStars] = useState<Star[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const starColors = [
      { bg: 'rgba(255, 255, 255, 1)', glow: 'rgba(255, 255, 255, 0.9)' },
      { bg: 'rgba(168, 85, 247, 1)', glow: 'rgba(168, 85, 247, 0.9)' },
      { bg: 'rgba(192, 132, 252, 1)', glow: 'rgba(192, 132, 252, 0.9)' },
    ];

    const initialStars: Star[] = Array.from({ length: 50 }, (_, i) => {
      const intensity = Math.random();
      const isBright = intensity > 0.6;
      // Mix of white and purple - roughly 50/50 split
      const useWhite = Math.random() > 0.5;
      const starColor = useWhite 
        ? 'rgba(255, 255, 255, 1)' 
        : Math.random() > 0.5 
          ? 'rgba(168, 85, 247, 1)' 
          : 'rgba(192, 132, 252, 1)';

      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isBright ? Math.random() * 2 + 1 : Math.random() * 1.5 + 0.5,
        opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        color: starColor,
      };
    });
    setStars(initialStars);

    // Create separate stars for section background
    const backgroundStarsArray: Star[] = Array.from({ length: 50 }, (_, i) => {
      const intensity = Math.random();
      const isBright = intensity > 0.6;
      // Mix of white and purple - roughly 50/50 split
      const useWhite = Math.random() > 0.5;
      const starColor = useWhite 
        ? 'rgba(255, 255, 255, 1)' 
        : Math.random() > 0.5 
          ? 'rgba(168, 85, 247, 1)' 
          : 'rgba(192, 132, 252, 1)';

      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isBright ? Math.random() * 2 + 1 : Math.random() * 1.5 + 0.5,
        opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        color: starColor,
      };
    });
    setBackgroundStars(backgroundStarsArray);
  }, []);

  const handleBuyClick = () => {
    window.open(BUY_PERSONAL_URL, '_blank');
  };

  return (
    <section 
      id="kendall-personal-hero"
      className="w-full relative overflow-hidden flex flex-col items-center"
      style={{ 
        padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 8rem)',
        backgroundColor: colors.primary,
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* Background Stars for entire section */}
      {backgroundStars.map((star) => {
        const glowSize = star.opacity > 0.4 ? star.size * 3 : star.size * 2;
        const glowOpacity = star.opacity > 0.4 ? 0.6 : 0.4;
        const starColor = star.color;
        const colorMatch = starColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        const r = colorMatch ? colorMatch[1] : '255';
        const g = colorMatch ? colorMatch[2] : '255';
        const b = colorMatch ? colorMatch[3] : '255';
        const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
        const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

        return (
          <div
            key={`bg-${star.id}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: starColor,
              opacity: star.opacity,
              animation: `sparkle-twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
              boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
              zIndex: 0,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
            }}
          />
        );
      })}
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center px-4" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header - MyKendall - Centered across entire section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(2rem, 4vw, 3rem)',
            width: '100%',
            marginBottom: 'clamp(4rem, 8vw, 6rem)',
            flexWrap: 'wrap',
          }}
        >
          <h2
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light leading-tight tracking-tight text-center"
            style={{ 
              color: colors.text,
              margin: 0,
            }}
          >
            <span 
              style={{
                color: colors.text,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
                display: 'inline-block',
              }}
            >
              My
            </span>
            <span 
              className="kendall-glow"
              style={{
                color: colors.accent,
                opacity: 0.85,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
                display: 'inline-block',
              }}
            >
              Kendall
            </span>
          </h2>
          {/* Simple Dot - No power-ups, just animated glow */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: 'clamp(80px, 10vw, 120px)',
              minHeight: 'clamp(80px, 10vw, 120px)',
              pointerEvents: 'none',
            }}
          >
            <SimpleDot />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-stretch w-full max-w-6xl mx-auto">
          {/* Left: Cards - 2x3 Grid */}
          <div className="order-2 lg:order-1 h-full">
            <div className="grid grid-cols-2 gap-3 h-full items-stretch">
              {[
                {
                  icon: <Briefcase className="w-6 h-6" />,
                  title: 'Career Assistant',
                  description: (
                    <>
                      Put <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span> in your LinkedIn or resume. She introduces you professionally, explains who you are, and forwards real opportunities to you - 24/7.
                    </>
                  ),
                },
                {
                  icon: <Megaphone className="w-6 h-6" />,
                  title: 'Social Reach',
                  description: (
                    <>
                      Add <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span> to your Instagram or TikTok bio. She gives people a quick intro to you and keeps your audience connected without you picking up.
                    </>
                  ),
                },
                {
                  icon: (
                    <div className="relative" style={{ width: '24px', height: '24px' }}>
                      <Phone className="w-6 h-6 absolute" style={{ left: '0', top: '0', opacity: 0.7 }} />
                      <Phone className="w-6 h-6 absolute" style={{ left: '4px', top: '4px' }} />
                    </div>
                  ),
                  title: 'Your Second Number',
                  description: (
                    <>
                      A clean, separate number for your socials, dating apps, or website. <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span> answers so you don't have to.
                    </>
                  ),
                },
                {
                  icon: <Sparkles className="w-6 h-6" />,
                  title: 'Talks Like You',
                  description: (
                    <>
                      Customize <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span>'s personality to speak in your style - or any style you want.
                    </>
                  ),
                },
                {
                  icon: <Shield className="w-6 h-6" />,
                  title: 'Handle Awkward Calls',
                  description: (
                    <>
                      Let <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span> pick up when you'd rather not. She filters, softens the interaction, and keeps you unbothered.
                    </>
                  ),
                },
                {
                  icon: <Zap className="w-6 h-6" />,
                  title: 'Instant Call Forwarding',
                  description: (
                    <>
                      <span style={{ color: colors.accent, fontWeight: 700 }}>Kendall</span> can forward important calls straight to your real phone - only when you want.
                    </>
                  ),
                },
              ].map((card, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-6 py-20 lg:py-24 px-20 lg:px-28 text-center lg:text-left h-full min-h-full transition-all duration-300 cursor-pointer overflow-hidden"
                  style={{ 
                    color: colors.text,
                    border: `1px solid ${colors.accent}80`,
                    borderRadius: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.boxShadow = `0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2), 0 0 60px rgba(168, 85, 247, 0.1)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${colors.accent}80`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex justify-center lg:justify-start" style={{ color: colors.accent }}>
                    {card.icon}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight" style={{ color: colors.text }}>
                    {card.title}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Action Zone - Purchase Section */}
          <div className="order-1 lg:order-2 flex flex-col items-start lg:items-start h-full" style={{ marginLeft: '0' }}>
            <div
              className="w-full flex flex-col gap-12 relative overflow-hidden group transition-all duration-300 h-full"
              style={{
                padding: '2.5rem',
                border: `${isHovered ? '4px' : '2px'} solid ${colors.accent}`,
                borderRadius: '16px',
                boxShadow: isHovered 
                  ? `0 0 40px rgba(168, 85, 247, 0.6), 0 0 80px rgba(168, 85, 247, 0.4), 0 0 120px rgba(168, 85, 247, 0.2)`
                  : 'none',
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Background Stars */}
              {stars.map((star) => {
                const baseGlowSize = star.opacity > 0.4 ? star.size * 3 : star.size * 2;
                const glowSize = isHovered ? baseGlowSize * 1.5 : baseGlowSize;
                const baseGlowOpacity = star.opacity > 0.4 ? 0.6 : 0.4;
                const glowOpacity = isHovered ? Math.min(baseGlowOpacity * 1.5, 0.9) : baseGlowOpacity;
                const starColor = star.color;
                const colorMatch = starColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                const r = colorMatch ? colorMatch[1] : '255';
                const g = colorMatch ? colorMatch[2] : '255';
                const b = colorMatch ? colorMatch[3] : '255';
                const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
                const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

                return (
                  <div
                    key={star.id}
                    className="absolute rounded-full pointer-events-none transition-all duration-300"
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      backgroundColor: starColor,
                      opacity: isHovered ? Math.min(star.opacity * 1.3, 1) : star.opacity,
                      animation: `sparkle-twinkle ${star.duration}s ease-in-out infinite`,
                      animationDelay: `${star.delay}s`,
                      boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
                      zIndex: 0,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              {/* BUY NOW Button - First */}
              <button
                onClick={handleBuyClick}
                className="group relative flex items-center justify-center overflow-visible w-full touch-manipulation transition-all duration-300"
                style={{
                  color: colors.text,
                  backgroundColor: colors.accent,
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '1.75rem 2rem',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  cursor: 'pointer',
                  minWidth: 'auto',
                  minHeight: '72px',
                  boxShadow: `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`,
                  outline: 'none',
                  textShadow: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  zIndex: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 50px rgba(168, 85, 247, 0.9), 0 0 100px rgba(168, 85, 247, 0.7), 0 0 150px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
              >
                <span style={{ position: 'relative', zIndex: 2, fontWeight: 700 }}>
                  BUY NOW
                </span>
              </button>

              {/* Pricing Display - Prominent */}
              <div className="flex flex-col gap-4" style={{ position: 'relative', zIndex: 1 }}>
                <div 
                  className="flex items-baseline gap-2"
                >
                  <span
                    style={{
                      fontSize: '3.5rem',
                      fontWeight: 700,
                      color: colors.accent,
                      fontFamily: 'var(--font-inter), sans-serif',
                      lineHeight: '1',
                    }}
                  >
                    $0.35
                  </span>
                  <span
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 300,
                      color: colors.text,
                      opacity: 0.8,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    /min
                  </span>
                </div>
                <p
                  className="text-base sm:text-lg font-light"
                  style={{ color: colors.text, opacity: 0.9 }}
                >
                  Pay any amount from $0.99
                </p>
              </div>

              {/* Urgency Message */}
              <p
                className="text-base sm:text-lg font-medium"
                style={{ 
                  color: colors.accent, 
                  opacity: 0.9, 
                  margin: 0, 
                  position: 'relative', 
                  zIndex: 1,
                }}
              >
                Get your number in 30 seconds.
              </p>

              {/* Trust Signals */}
              <div className="flex flex-col gap-4" style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center gap-3">
                  <span 
                    style={{ 
                      color: colors.accent, 
                      fontSize: '1rem', 
                      fontWeight: 600,
                    }}
                  >✓</span>
                  <span style={{ color: colors.text, opacity: 0.8, fontSize: '0.95rem', fontFamily: 'var(--font-inter), sans-serif' }}>No commitments</span>
                </div>
                <div className="flex items-center gap-3">
                  <span 
                    style={{ 
                      color: colors.accent, 
                      fontSize: '1rem', 
                      fontWeight: 600,
                    }}
                  >✓</span>
                  <span style={{ color: colors.text, opacity: 0.8, fontSize: '0.95rem', fontFamily: 'var(--font-inter), sans-serif' }}>Instant activation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

