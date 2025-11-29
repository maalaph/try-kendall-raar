'use client';

import { useState, useEffect } from 'react';
import CalendarEmbed from '@/components/CalendarEmbed';
import { colors } from '@/lib/config';
import { Handshake, Users } from 'lucide-react';

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

export default function TalkPage() {
  const [isClient, setIsClient] = useState(false);
  const [cardSparkles, setCardSparkles] = useState<Sparkle[][]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate sparkles for each card
  useEffect(() => {
    const starColors = [
      { bg: 'rgba(255, 255, 255, 1)', glow: 'rgba(255, 255, 255, 0.8)' },
      { bg: 'rgba(168, 85, 247, 1)', glow: 'rgba(168, 85, 247, 0.8)' },
      { bg: 'rgba(192, 132, 252, 1)', glow: 'rgba(192, 132, 252, 0.8)' },
    ];

    const sparklesForCards: Sparkle[][] = [];
    for (let cardIndex = 0; cardIndex < 2; cardIndex++) {
      const cardSparkles: Sparkle[] = Array.from({ length: 15 }, (_, i) => {
        const intensity = Math.random();
        const isBright = intensity > 0.6;
        const colorIndex = Math.floor(Math.random() * starColors.length);
        const starColor = starColors[colorIndex];

        return {
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: isBright ? Math.random() * 2 + 1 : Math.random() * 1.5 + 0.5,
          opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.15,
          duration: Math.random() * 5 + 2,
          delay: Math.random() * 3,
          intensity: intensity,
          color: starColor.bg,
        };
      });
      sparklesForCards.push(cardSparkles);
    }
    setCardSparkles(sparklesForCards);
  }, []);

  const cards = [
    {
      icon: <Handshake className="w-8 h-8" />,
      title: 'Business Solutions',
      description: 'Interested in implementing solutions that change the way your business runs?',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Open Conversation',
      description: (
        <>
          Want to speak to us or meet us?<br />
          Anything, really. We're open to it all.
        </>
      ),
    },
  ];

  return (
    <main className="min-h-screen" style={{ backgroundColor: colors.primary }}>
      <div
        className="w-full min-h-screen flex flex-col items-center justify-center"
        style={{ 
          padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 8rem)',
          paddingTop: 'clamp(10rem, 18vw, 16rem)', // More space from navbar
        }}
      >
        {/* Header */}
        <h2
          className="w-full text-center mb-12"
          style={{
            color: colors.text,
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 700,
            fontFamily: 'var(--font-league-spartan), sans-serif',
            letterSpacing: '-0.02em',
            marginBottom: 'clamp(3rem, 6vw, 4rem)',
          }}
        >
          We're also available <span style={{ color: colors.accent }}>24/7</span>.
        </h2>

        {/* Icon Cards */}
        <div className="w-full flex flex-col items-center" style={{ maxWidth: '800px', marginBottom: 'clamp(3rem, 6vw, 4rem)' }}>
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 w-full">
            {cards.map((card, index) => (
              <div
                key={index}
                className="border border-purple-500/20 rounded-xl flex flex-col gap-6 text-center relative overflow-hidden transition-all duration-300"
                style={{ 
                  color: colors.text,
                  backgroundColor: 'transparent',
                  position: 'relative',
                  padding: 'clamp(1.5rem, 3vw, 2rem)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.borderColor = `${colors.accent}60`;
                  e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}50, 0 0 80px ${colors.accent}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = `${colors.accent}20`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Stars background */}
                {cardSparkles[index] && cardSparkles[index].map((sparkle) => {
                  const glowSize = sparkle.intensity > 0.6 ? sparkle.size * 4 : sparkle.size * 2;
                  const glowOpacity = sparkle.intensity > 0.6 ? 0.6 : 0.3;
                  const colorMatch = sparkle.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                  const r = colorMatch ? colorMatch[1] : '255';
                  const g = colorMatch ? colorMatch[2] : '255';
                  const b = colorMatch ? colorMatch[3] : '255';
                  const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
                  const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;

                  return (
                    <div
                      key={sparkle.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: `${sparkle.x}%`,
                        top: `${sparkle.y}%`,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        backgroundColor: sparkle.color,
                        opacity: sparkle.opacity,
                        animation: `sparkle-twinkle ${sparkle.duration}s ease-in-out infinite`,
                        animationDelay: `${sparkle.delay}s`,
                        boxShadow: `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 1.5}px ${glowColorDim}`,
                        zIndex: 0,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  );
                })}

                {/* Card content */}
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex justify-center" style={{ color: colors.accent }}>
                    {card.icon}
                  </div>
                  <h3 
                    className="text-lg font-semibold tracking-tight" 
                    style={{ color: colors.text }}
                  >
                    {card.title}
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: colors.text, opacity: 0.9, lineHeight: '1.6' }}
                  >
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Calendar - Only render on client */}
        {isClient && (
          <div className="w-full" style={{ maxWidth: '900px', marginTop: 'clamp(2rem, 4vw, 3rem)' }}>
            <CalendarEmbed />
          </div>
        )}
      </div>
    </main>
  );
}

