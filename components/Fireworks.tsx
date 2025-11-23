'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface FireworksProps {
  trigger: boolean;
  onComplete?: () => void;
}

export default function Fireworks({ trigger, onComplete }: FireworksProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      // Create multiple firework bursts
      const burstCount = 6; // Number of firework bursts
      const particlesPerBurst = 40;

      for (let b = 0; b < burstCount; b++) {
        const burstX = 15 + Math.random() * 70; // Random X position (15-85%)
        const burstY = 20 + Math.random() * 50; // Random Y position (20-70%)
        const delay = b * 400; // Stagger bursts

        setTimeout(() => {
          const newParticles: Particle[] = [];
          for (let i = 0; i < particlesPerBurst; i++) {
            const angle = (Math.PI * 2 * i) / particlesPerBurst + (Math.random() - 0.5) * 0.3;
            const speed = 2.5 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            newParticles.push({
              id: Date.now() + i + b * 10000,
              x: burstX,
              y: burstY,
              vx: vx,
              vy: vy,
              life: 0,
              maxLife: 1200 + Math.random() * 600,
              size: 4 + Math.random() * 5,
            });
          }
          setParticles((prev) => [...prev, ...newParticles]);
        }, delay);
      }

      // Clean up after animation completes
      setTimeout(() => {
        setIsActive(false);
        setParticles([]);
        if (onComplete) onComplete();
      }, 6000);
    }
  }, [trigger, isActive, onComplete]);

  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) => {
        return prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * 0.1,
            y: p.y + p.vy * 0.1,
            vy: p.vy + 0.05, // Gravity
            life: p.life + 16,
          }))
          .filter((p) => p.life < p.maxLife);
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [particles.length]);

  if (!isActive && particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        overflow: 'hidden',
      }}
    >
      {particles.map((particle) => {
        const progress = particle.life / particle.maxLife;
        const opacity = 1 - progress;
        const scale = 1 - progress * 0.5;

        // Purple gradient colors - vibrant purple range
        const hue = 260 + Math.random() * 30; // Purple range (260-290)
        const saturation = 70 + Math.random() * 30; // High saturation
        const lightness = 55 + Math.random() * 25; // Bright purple

        return (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size * scale}px`,
              height: `${particle.size * scale}px`,
              background: `radial-gradient(circle, 
                hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity}), 
                hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.5}), 
                transparent)`,
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 ${particle.size * 2}px hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity * 0.8})`,
              opacity: opacity,
            }}
          />
        );
      })}
    </div>
  );
}

