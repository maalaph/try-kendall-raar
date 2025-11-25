'use client';

import { useState, useEffect, useRef } from 'react';
import { colors } from '@/lib/config';

interface KendallProgressFigureProps {
  currentStep: number;
  businessType: string | null;
  callVolume: string | null;
  selectedAddOns: string[];
}

export default function KendallProgressFigure({
  currentStep,
  businessType,
  callVolume,
  selectedAddOns,
}: KendallProgressFigureProps) {
  const [justAddedAddOn, setJustAddedAddOn] = useState(false);
  const prevAddOnCountRef = useRef(selectedAddOns.length);

  useEffect(() => {
    if (selectedAddOns.length > prevAddOnCountRef.current) {
      setJustAddedAddOn(true);
      setTimeout(() => setJustAddedAddOn(false), 800);
    }
    prevAddOnCountRef.current = selectedAddOns.length;
  }, [selectedAddOns.length]);
  // Calculate progress: 0 = no selections, 1 = all steps complete
  // Now only 2 steps: 1) Business Type, 2) Pricing Summary (with slider and add-ons)
  const calculateProgress = () => {
    let progress = 0;
    if (businessType) progress += 0.5; // Step 1
    if (currentStep >= 2) progress += 0.5; // Step 2 (pricing summary)
    
    return Math.min(1, progress);
  };

  const progress = calculateProgress();
  // Maintain same size as step 4 (no growth on step 5)
  const baseSize = 40 + (progress * 60); // 40px to 100px (smaller)
  const glowIntensity = 0.4 + (progress * 0.6); // 0.4 to 1.0
  const hasAddOns = selectedAddOns.length > 0;
  const addOnCount = selectedAddOns.length;
  
  // Circle only appears at Standard Features (step 3)
      const showCircle = currentStep >= 3; // Show circle on pricing summary step
  // Circle draws out with add-ons (each add-on adds 12.5% more)
  const circleProgress = showCircle ? Math.min(1, 0.5 + (addOnCount * 0.125)) : 0;

  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: '100%',
        marginTop: '2rem',
        marginBottom: '1rem',
        minHeight: '350px',
        position: 'relative',
        overflow: 'visible',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '400px',
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
        }}
      >
        {/* Container center point marker - invisible, for debugging alignment */}
        {/* All elements should be centered relative to this point */}
        {/* Outer glow layer - grows with progress */}
        <div
          style={{
            position: 'absolute',
            width: `${baseSize * 1.8}px`,
            height: `${baseSize * 1.8}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 30)} 0%, ${colors.accent}00 70%)`,
            filter: `blur(${25 + progress * 20}px)`,
            opacity: glowIntensity * 0.6,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'float-glow 4s ease-in-out infinite',
          }}
        />

        {/* Middle glow layer */}
        <div
          style={{
            position: 'absolute',
            width: `${baseSize * 1.4}px`,
            height: `${baseSize * 1.4}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 50)} 0%, ${colors.accent}00 65%)`,
            filter: `blur(${15 + progress * 15}px)`,
            opacity: glowIntensity * 0.8,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'float-glow 3s ease-in-out infinite',
            animationDelay: '0.2s',
          }}
        />

        {/* Core glow - brightest center */}
        <div
          style={{
            position: 'absolute',
            width: `${baseSize}px`,
            height: `${baseSize}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 100)} 0%, ${colors.accent}${Math.round(glowIntensity * 60)} 50%, ${colors.accent}00 100%)`,
            filter: `blur(${10 + progress * 10}px)`,
            opacity: glowIntensity,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'float-glow 2s ease-in-out infinite',
            boxShadow: `0 0 ${20 + progress * 30}px ${colors.accent}${Math.round(glowIntensity * 80)}`,
          }}
        />

        {/* Building circle rings - only appear at Standard Features, power up with add-ons */}
        {showCircle && (
          <>
            {/* Primary ring - starts at Standard Features, draws out with add-ons */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: `${Math.min(baseSize * (2.2 + addOnCount * 0.1), 240)}px`,
                height: `${Math.min(baseSize * (2.2 + addOnCount * 0.1), 240)}px`,
                transform: 'translate(-50%, -50%)',
                opacity: circleProgress > 0.1 ? 0.9 : 0,
                transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: `conic-gradient(from -90deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${circleProgress * 360}deg, transparent ${circleProgress * 360}deg, transparent 360deg)`,
                  mask: 'radial-gradient(circle at 50% 50%, transparent 48%, black 48.5%, black 51.5%, transparent 52%)',
                  WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 48%, black 48.5%, black 51.5%, transparent 52%)',
                  border: addOnCount > 0 ? `2px solid ${colors.accent}40` : 'none',
                  boxShadow: addOnCount > 0 ? `0 0 ${10 + addOnCount * 5}px ${colors.accent}50` : 'none',
                  animation: 'rotate-smooth 8s linear infinite',
                  transformOrigin: 'center center',
                }}
              />
            </div>

            {/* Power-up ring 1 - appears with first add-on */}
            {addOnCount >= 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${Math.min(baseSize * 2.4, 260)}px`,
                  height: `${Math.min(baseSize * 2.4, 260)}px`,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.7,
                  transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(from 180deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${circleProgress * 360}deg, transparent ${circleProgress * 360}deg, transparent 360deg)`,
                    mask: 'radial-gradient(circle at 50% 50%, transparent 46%, black 46.5%, black 49.5%, transparent 50%)',
                    WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 46%, black 46.5%, black 49.5%, transparent 50%)',
                    boxShadow: `0 0 ${8 + addOnCount * 3}px ${colors.accent}40`,
                    animation: 'rotate-smooth 10s linear infinite reverse',
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}

            {/* Power-up ring 2 - appears with second add-on */}
            {addOnCount >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${Math.min(baseSize * 2.6, 280)}px`,
                  height: `${Math.min(baseSize * 2.6, 280)}px`,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.6,
                  transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(from 90deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${circleProgress * 360}deg, transparent ${circleProgress * 360}deg, transparent 360deg)`,
                    mask: 'radial-gradient(circle at 50% 50%, transparent 44%, black 44.5%, black 47.5%, transparent 48%)',
                    WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 44%, black 44.5%, black 47.5%, transparent 48%)',
                    boxShadow: `0 0 ${10 + addOnCount * 4}px ${colors.accent}50`,
                    animation: 'rotate-smooth 12s linear infinite',
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}

            {/* Power-up ring 3 - appears with third add-on */}
            {addOnCount >= 3 && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${Math.min(baseSize * 2.8, 300)}px`,
                  height: `${Math.min(baseSize * 2.8, 300)}px`,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.5,
                  transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(from 270deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${circleProgress * 360}deg, transparent ${circleProgress * 360}deg, transparent 360deg)`,
                    mask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 42.5%, black 45.5%, transparent 46%)',
                    WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 42.5%, black 45.5%, transparent 46%)',
                    boxShadow: `0 0 ${12 + addOnCount * 5}px ${colors.accent}60`,
                    animation: 'rotate-smooth 14s linear infinite reverse',
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}

            {/* Power-up ring 4 - appears with fourth add-on (MAX POWER!) */}
            {addOnCount >= 4 && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${Math.min(baseSize * 3.0, 320)}px`,
                  height: `${Math.min(baseSize * 3.0, 320)}px`,
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.8,
                  transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(from 0deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${circleProgress * 360}deg, transparent ${circleProgress * 360}deg, transparent 360deg)`,
                    mask: 'radial-gradient(circle at 50% 50%, transparent 40%, black 40.5%, black 43.5%, transparent 44%)',
                    WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 40%, black 40.5%, black 43.5%, transparent 44%)',
                    boxShadow: `0 0 ${15 + addOnCount * 6}px ${colors.accent}70, 0 0 ${30 + addOnCount * 8}px ${colors.accent}50`,
                    animation: 'rotate-smooth 16s linear infinite',
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}

            {/* Orbiting power-up particles - appear with add-ons */}
            {hasAddOns && Array.from({ length: addOnCount * 2 }).map((_, i) => (
              <div
                key={`power-particle-${i}`}
                style={{
                  position: 'absolute',
                  width: `${6 + (i % 2) * 2}px`,
                  height: `${6 + (i % 2) * 2}px`,
                  borderRadius: '50%',
                  background: colors.accent,
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) rotate(${(360 / (addOnCount * 2)) * i}deg) translateY(${baseSize * (1.3 + (addOnCount * 0.1))}px)`,
                  opacity: 0.9,
                  animation: `orbit ${4 + (i % 3)}s linear infinite`,
                  animationDelay: `${i * 0.2}s`,
                  boxShadow: `0 0 ${8 + addOnCount * 3}px ${colors.accent}`,
                  zIndex: 3,
                }}
              />
            ))}
          </>
        )}

        {/* Orbiting particles inside - building motion, only after Standard Features */}
        {showCircle && progress > 0.2 && [0, 1, 2].map((i) => (
          <div
            key={`particle-${i}`}
            style={{
              position: 'absolute',
              width: `${6 + progress * 3}px`,
              height: `${6 + progress * 3}px`,
              borderRadius: '50%',
              background: colors.accent,
              opacity: 0.8,
              filter: `blur(1px)`,
              animation: `orbit ${3 + i}s linear infinite`,
              animationDelay: `${i * 0.5}s`,
              transformOrigin: `${baseSize * 0.7}px 0`,
              left: '50%',
              top: '50%',
              boxShadow: `0 0 ${8 + progress * 6}px ${colors.accent}`,
              zIndex: 1,
            }}
          />
        ))}

        {/* Building sparkles inside - appear with add-ons, move around */}
        {hasAddOns && Array.from({ length: addOnCount * 4 }).map((_, i) => (
          <div
            key={`sparkle-${i}`}
            style={{
              position: 'absolute',
              width: `${4 + (i % 3)}px`,
              height: `${4 + (i % 3)}px`,
              borderRadius: '50%',
              background: colors.accent,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${(360 / (addOnCount * 4)) * i}deg) translateY(${baseSize * (0.6 + (addOnCount * 0.05))}px)`,
              opacity: 0.9,
              animation: `sparkle-rotate ${2 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
              boxShadow: `0 0 ${6 + progress * 4 + addOnCount * 2}px ${colors.accent}`,
              zIndex: 1,
            }}
          />
        ))}

        {/* Rotating inner particles - cooking/building motion, only after Standard Features */}
        {showCircle && progress > 0.4 && [0, 1].map((i) => (
          <div
            key={`inner-particle-${i}`}
            style={{
              position: 'absolute',
              width: `${5 + progress * 2}px`,
              height: `${5 + progress * 2}px`,
              borderRadius: '50%',
              background: colors.accent,
              opacity: 0.7,
              animation: `orbit ${4 + i * 2}s linear infinite`,
              animationDelay: `${i * 1}s`,
              animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
              transformOrigin: `${baseSize * 0.5}px 0`,
              left: '50%',
              top: '50%',
              boxShadow: `0 0 ${6 + progress * 4}px ${colors.accent}`,
              zIndex: 1,
            }}
          />
        ))}

        {/* Inner core - solid center with building pulse */}
        <div
          style={{
            position: 'absolute',
            width: `${baseSize * 0.4}px`,
            height: `${baseSize * 0.4}px`,
            borderRadius: '50%',
            background: colors.accent,
            opacity: 0.95,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: justAddedAddOn ? 'addon-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'pulse-core 2s ease-in-out infinite',
            boxShadow: justAddedAddOn 
              ? `0 0 ${25 + progress * 30 + addOnCount * 10}px ${colors.accent}, 0 0 ${50 + progress * 50 + addOnCount * 15}px ${colors.accent}95`
              : `0 0 ${15 + progress * 20 + addOnCount * 5}px ${colors.accent}, 0 0 ${30 + progress * 30 + addOnCount * 8}px ${colors.accent}80`,
            zIndex: 3,
          }}
        />

      </div>
    </div>
  );
}
