'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  intensity: number; // 0-1, determines how sparkly
  color: string; // Star color
}

export default function AnimatedBackground() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    // Star colors like real stars: white, blue, yellow, orange, red
    const starColors = [
      { bg: 'rgba(255, 255, 255, 1)', glow: 'rgba(255, 255, 255, 0.8)' }, // White
      { bg: 'rgba(173, 216, 255, 1)', glow: 'rgba(173, 216, 255, 0.8)' }, // Blue
      { bg: 'rgba(255, 255, 200, 1)', glow: 'rgba(255, 255, 200, 0.8)' }, // Yellow
      { bg: 'rgba(255, 200, 150, 1)', glow: 'rgba(255, 200, 150, 0.8)' }, // Orange
      { bg: 'rgba(255, 180, 180, 1)', glow: 'rgba(255, 180, 180, 0.8)' }, // Red
    ];
    
    // Create minimalistic sparkles - galaxy stars vibe with varying intensity and colors
    const initialSparkles: Sparkle[] = Array.from({ length: 50 }, (_, i) => {
      const intensity = Math.random(); // 0-1, determines sparkle intensity
      const isBright = intensity > 0.7; // 30% are brighter/more sparkly
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const starColor = starColors[colorIndex];
      
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: isBright ? Math.random() * 3 + 1.5 : Math.random() * 2 + 0.8,
        opacity: isBright ? Math.random() * 0.6 + 0.4 : Math.random() * 0.4 + 0.15,
        duration: Math.random() * 5 + 2,
        delay: Math.random() * 3,
        intensity: intensity,
        color: starColor.bg,
      };
    });
    setSparkles(initialSparkles);
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ 
        backgroundColor: 'transparent',
        zIndex: 0,
      }}
    >
      {sparkles.map((sparkle) => {
        const glowSize = sparkle.intensity > 0.7 ? sparkle.size * 6 : sparkle.size * 3;
        const glowOpacity = sparkle.intensity > 0.7 ? 0.8 : 0.4;
        // Extract RGB from color string for glow effect
        const colorMatch = sparkle.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        const r = colorMatch ? colorMatch[1] : '255';
        const g = colorMatch ? colorMatch[2] : '255';
        const b = colorMatch ? colorMatch[3] : '255';
        const glowColor = `rgba(${r}, ${g}, ${b}, ${glowOpacity})`;
        const glowColorDim = `rgba(${r}, ${g}, ${b}, ${glowOpacity * 0.5})`;
        
        return (
          <div
            key={sparkle.id}
            className="absolute rounded-full"
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
            }}
          />
        );
      })}
    </div>
  );
}

