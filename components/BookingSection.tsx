'use client';

import { useState, useEffect } from 'react';
import ConfiguratorWizard from './ConfiguratorWizard';

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

export default function BookingSection() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
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
  }, []);

  return (
    <section id="booking-section" className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Background Stars */}
      {stars.map((star) => {
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
            key={star.id}
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
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ConfiguratorWizard />
      </div>
    </section>
  );
}

