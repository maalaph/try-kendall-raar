'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

interface KendallPowerUpsProps {
  selectedAddOns: string[];
  hoveredAddOnId?: string | null;
  justToggledAddOnId?: string | null;
  businessType?: string | null;
  shouldAnimate?: boolean;
}

export default function KendallPowerUps({
  selectedAddOns,
  hoveredAddOnId,
  justToggledAddOnId,
  businessType,
  shouldAnimate = false,
}: KendallPowerUpsProps) {
  const [isHinting, setIsHinting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (shouldAnimate) {
      // Show immediately when shouldAnimate is true (when header appears)
      // Once visible, keep it visible forever
      setHasBeenVisible(true);
    }
  }, [shouldAnimate]);

  useEffect(() => {
    if (hoveredAddOnId) {
      setIsHinting(true);
    } else {
      setIsHinting(false);
    }
  }, [hoveredAddOnId]);

  useEffect(() => {
    if (justToggledAddOnId) {
      setIsActivating(true);
      const timer = setTimeout(() => setIsActivating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [justToggledAddOnId]);

  const addOnCount = selectedAddOns.length;
  const typeData = businessType ? getBusinessTypeData(businessType) : null;
  const totalAddOns = typeData?.addOns?.length || 0;
  const isMaxPower = totalAddOns > 0 && addOnCount === totalAddOns;
  const baseSize = 60;
  const glowIntensity = isMaxPower ? 1.0 : 0.5 + (addOnCount * 0.1);

  // Once visible, always visible - no more opacity/transform transitions
  const isVisible = hasBeenVisible;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: '180px',
        height: '180px',
        pointerEvents: 'none',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) translateY(0) scale(1)' : 'translateX(20px) translateY(-10px) scale(0.9)',
        transition: hasBeenVisible ? 'none' : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Outer glow layer */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize * 1.8}px`,
          height: `${baseSize * 1.8}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 30)} 0%, ${colors.accent}00 70%)`,
          filter: `blur(${20}px)`,
          opacity: glowIntensity * 0.6,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: isHinting 
            ? 'hint-pulse 1s ease-in-out infinite'
            : isActivating
            ? 'activate-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'float-glow 4s ease-in-out infinite',
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
          filter: `blur(${12}px)`,
          opacity: glowIntensity * 0.8,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: isHinting 
            ? 'hint-pulse 1.2s ease-in-out infinite'
            : isActivating
            ? 'activate-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'float-glow 3s ease-in-out infinite',
          animationDelay: '0.2s',
        }}
      />

      {/* Core glow */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize}px`,
          height: `${baseSize}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.accent}${Math.round(glowIntensity * 100)} 0%, ${colors.accent}${Math.round(glowIntensity * 60)} 50%, ${colors.accent}00 100%)`,
          filter: `blur(${8}px)`,
          opacity: glowIntensity,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: isHinting 
            ? 'hint-pulse 1.4s ease-in-out infinite'
            : isActivating
            ? 'activate-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'float-glow 2s ease-in-out infinite',
          boxShadow: `0 0 ${20 + addOnCount * 5}px ${colors.accent}${Math.round(glowIntensity * 80)}`,
        }}
      />

      {/* Power-up rings - appear with add-ons */}
      {addOnCount >= 1 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${baseSize * 1.8}px`,
            height: `${baseSize * 1.8}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.8,
            transition: 'opacity 0.5s ease',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `conic-gradient(from -90deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${Math.min(addOnCount * 90, 360)}deg, transparent ${Math.min(addOnCount * 90, 360)}deg, transparent 360deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 45%, black 45.5%, black 54.5%, transparent 55%)',
              WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 45%, black 45.5%, black 54.5%, transparent 55%)',
              boxShadow: `0 0 ${10 + addOnCount * 3}px ${colors.accent}50`,
              animation: isActivating 
                ? 'activate-rotate 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'rotate-smooth 8s linear infinite',
              transformOrigin: 'center center',
            }}
          />
        </div>
      )}

      {addOnCount >= 2 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${baseSize * 2.0}px`,
            height: `${baseSize * 2.0}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.6,
            transition: 'opacity 0.5s ease',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `conic-gradient(from 180deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} ${Math.min(addOnCount * 90, 360)}deg, transparent ${Math.min(addOnCount * 90, 360)}deg, transparent 360deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 43%, black 43.5%, black 56.5%, transparent 57%)',
              WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 43%, black 43.5%, black 56.5%, transparent 57%)',
              boxShadow: `0 0 ${12 + addOnCount * 4}px ${colors.accent}60`,
              animation: isActivating 
                ? 'activate-rotate 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) reverse'
                : 'rotate-smooth 10s linear infinite reverse',
              transformOrigin: 'center center',
            }}
          />
        </div>
      )}

      {/* Orbiting particles - appear with add-ons */}
      {addOnCount > 0 && Array.from({ length: Math.min(addOnCount * 2, 8) }).map((_, i) => (
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
            transform: `translate(-50%, -50%) rotate(${(360 / Math.min(addOnCount * 2, 8)) * i}deg) translateY(${baseSize * 1.2}px)`,
            opacity: isActivating ? 1 : 0.9,
            animation: isActivating
              ? 'activate-orbit 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : `orbit ${4 + (i % 3)}s linear infinite`,
            animationDelay: `${i * 0.2}s`,
            boxShadow: `0 0 ${8 + addOnCount * 2}px ${colors.accent}`,
            zIndex: 3,
            transition: 'all 0.3s ease',
          }}
        />
      ))}

      {/* Inner core */}
      <div
        style={{
          position: 'absolute',
          width: `${baseSize * 0.5}px`,
          height: `${baseSize * 0.5}px`,
          borderRadius: '50%',
          background: colors.accent,
          opacity: 0.95,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: isActivating 
            ? 'activate-core 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : isMaxPower
            ? 'max-power-pulse 1.5s ease-in-out infinite'
            : 'pulse-core 2s ease-in-out infinite',
          boxShadow: isActivating
            ? `0 0 ${30 + addOnCount * 10}px ${colors.accent}, 0 0 ${60 + addOnCount * 15}px ${colors.accent}95`
            : isMaxPower
            ? `0 0 ${40 + addOnCount * 10}px ${colors.accent}, 0 0 ${80 + addOnCount * 15}px ${colors.accent}95, 0 0 ${120 + addOnCount * 20}px ${colors.accent}80`
            : `0 0 ${15 + addOnCount * 5}px ${colors.accent}, 0 0 ${30 + addOnCount * 8}px ${colors.accent}80`,
          zIndex: 3,
          scale: isHinting ? 1.1 : isActivating ? 1.3 : isMaxPower ? 1.15 : 1,
        }}
      />

      {/* MAX POWER - Special effect when all add-ons selected */}
      {isMaxPower && (
        <>
          {/* Extra glowing rings for max power */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: `${baseSize * 2.5}px`,
              height: `${baseSize * 2.5}px`,
              transform: 'translate(-50%, -50%)',
              opacity: 0.7,
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `conic-gradient(from 0deg at 50% 50%, ${colors.accent} 0deg, ${colors.accent} 90deg, transparent 90deg, transparent 180deg, ${colors.accent} 180deg, ${colors.accent} 270deg, transparent 270deg, transparent 360deg)`,
                mask: 'radial-gradient(circle at 50% 50%, transparent 40%, black 40.5%, black 59.5%, transparent 60%)',
                WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 40%, black 40.5%, black 59.5%, transparent 60%)',
                boxShadow: `0 0 ${20 + addOnCount * 5}px ${colors.accent}70`,
                animation: 'rotate-smooth 6s linear infinite',
                transformOrigin: 'center center',
              }}
            />
          </div>

          {/* Extra particles for max power */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`max-power-particle-${i}`}
              style={{
                position: 'absolute',
                width: `${8 + (i % 3)}px`,
                height: `${8 + (i % 3)}px`,
                borderRadius: '50%',
                background: colors.accent,
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) rotate(${(360 / 12) * i}deg) translateY(${baseSize * 1.8}px)`,
                opacity: 0.9,
                animation: `orbit ${3 + (i % 2)}s linear infinite`,
                animationDelay: `${i * 0.15}s`,
                boxShadow: `0 0 ${15 + addOnCount * 3}px ${colors.accent}, 0 0 ${30 + addOnCount * 5}px ${colors.accent}80`,
                zIndex: 3,
              }}
            />
          ))}

          {/* Pulsing outer glow for max power */}
          <div
            style={{
              position: 'absolute',
              width: `${baseSize * 3}px`,
              height: `${baseSize * 3}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors.accent}30 0%, ${colors.accent}10 50%, transparent 100%)`,
              filter: 'blur(30px)',
              opacity: 0.8,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'max-power-glow 2s ease-in-out infinite',
              zIndex: 1,
            }}
          />
        </>
      )}

    </div>
  );
}

