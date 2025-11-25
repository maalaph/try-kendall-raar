'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/lib/config';
import { businessTypeIds, businessTypesData } from '@/lib/businessTypes';

interface BusinessTypeStepProps {
  selectedType: string | null;
  onSelect: (type: string) => void;
  shouldAnimate?: boolean;
}

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

export default function BusinessTypeStep({
  selectedType,
  onSelect,
  shouldAnimate = false,
}: BusinessTypeStepProps) {
  const router = useRouter();
  const [headerVisible, setHeaderVisible] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<number[]>([]);
  const [starsByType, setStarsByType] = useState<Record<string, Star[]>>({});

  // Generate stars for each business type
  useEffect(() => {
    const starColors = [
      'rgba(255, 255, 255, 1)',
      'rgba(168, 85, 247, 1)',
      'rgba(192, 132, 252, 1)',
    ];

    const stars: Record<string, Star[]> = {};
    businessTypeIds.forEach((typeId) => {
      const typeStars: Star[] = Array.from({ length: 8 }, (_, i) => {
        const intensity = Math.random();
        const isBright = intensity > 0.6;
        const colorIndex = Math.floor(Math.random() * starColors.length);
        const starColor = starColors[colorIndex];

        return {
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: isBright ? Math.random() * 1.5 + 0.8 : Math.random() * 1 + 0.5,
          opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
          duration: Math.random() * 4 + 2,
          delay: Math.random() * 3,
          color: starColor,
        };
      });
      stars[typeId] = typeStars;
    });
    setStarsByType(stars);
  }, []);

  useEffect(() => {
    if (shouldAnimate) {
      // Animate header first
      setTimeout(() => setHeaderVisible(true), 100);
      
      // Then animate business types sequentially
      // Only include "Other" if no type is selected
      const totalItems = !selectedType ? businessTypeIds.length + 1 : businessTypeIds.length;
      for (let index = 0; index < totalItems; index++) {
        setTimeout(() => {
          setVisibleTypes((prev) => [...prev, index]);
        }, 300 + (index * 100));
      }
    } else {
      setHeaderVisible(true);
      // Only include "Other" if no type is selected
      const totalItems = !selectedType ? businessTypeIds.length + 1 : businessTypeIds.length;
      setVisibleTypes(Array.from({ length: totalItems }, (_, i) => i));
    }
  }, [shouldAnimate, selectedType]);

  return (
    <div 
      className={selectedType ? "w-full" : ""} 
      style={{ 
        minHeight: selectedType ? '60px' : '200px',
        maxWidth: selectedType ? '100%' : '100%',
        width: selectedType ? '100%' : 'auto',
        marginLeft: selectedType ? '0' : 'auto',
        marginRight: selectedType ? '0' : 'auto',
        display: 'flex',
        justifyContent: selectedType ? 'flex-start' : 'center',
        alignItems: 'center',
        transition: 'min-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), margin-left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), margin-right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div 
        className={selectedType ? "flex gap-3 sm:gap-4 overflow-x-auto pb-2" : "grid grid-cols-2 gap-4"}
        style={{
          scrollbarWidth: selectedType ? 'thin' : 'none',
          scrollbarColor: `${colors.accent}40 transparent`,
          position: 'relative',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          width: selectedType ? '100%' : 'auto',
          maxWidth: selectedType ? '100%' : '600px',
        }}
      >
        {businessTypeIds.map((typeId, index) => {
          const isVisible = visibleTypes.includes(index);
          const typeData = businessTypesData[typeId];
          const isSelected = selectedType === typeId;
          return (
            <button
              key={typeId}
              onClick={() => onSelect(typeId)}
              className={selectedType ? "touch-manipulation flex-shrink-0 relative overflow-hidden" : "touch-manipulation relative overflow-hidden"}
              style={{
                padding: '1.5rem 2.5rem',
                borderRadius: '24px',
                border: `2px solid ${isSelected ? colors.accent : selectedType ? `${colors.accent}30` : colors.accent}`,
                backgroundColor: isSelected ? `${colors.accent}15` : 'transparent',
                color: colors.text,
                fontSize: '1.1rem',
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: isVisible ? (isSelected ? 1 : selectedType ? 0.5 : 0.8) : 0,
                transform: isVisible ? 'translateX(0) translateY(0) scale(1)' : 'translateX(-20px) translateY(-5px) scale(1)',
                whiteSpace: selectedType ? 'nowrap' : 'normal',
                flexShrink: selectedType ? 0 : 1,
                width: selectedType ? 'auto' : '100%',
                boxShadow: isSelected 
                  ? `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30` 
                  : selectedType 
                    ? 'none' 
                    : `0 0 15px ${colors.accent}30`,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = selectedType ? '0.7' : '1';
                  e.currentTarget.style.borderColor = selectedType ? `${colors.accent}50` : colors.accent;
                  if (!selectedType) {
                    e.currentTarget.style.boxShadow = `0 0 25px ${colors.accent}60, 0 0 50px ${colors.accent}40, 0 0 75px ${colors.accent}25`;
                  }
                  e.currentTarget.style.transform = 'scale(1.08)';
                } else {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}60, 0 0 80px ${colors.accent}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = selectedType ? '0.5' : '0.8';
                  e.currentTarget.style.borderColor = selectedType ? `${colors.accent}30` : colors.accent;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'scale(1)';
                } else {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`;
                }
              }}
            >
              {/* Stars inside the box */}
              {starsByType[typeId]?.map((star) => {
                const glowSize = star.opacity > 0.4 ? star.size * 3 : star.size * 2;
                const glowOpacity = star.opacity > 0.4 ? 0.6 : 0.4;
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
                      zIndex: 0,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {typeData.name}
              </span>
            </button>
          );
        })}
        {/* "Other" option - 6th item - Only show when no type is selected */}
        {!selectedType && (() => {
          const otherIndex = businessTypeIds.length;
          const isVisible = visibleTypes.includes(otherIndex);
          
          // Generate stars for "Other" button
          const otherStars: Star[] = Array.from({ length: 8 }, (_, i) => {
            const intensity = Math.random();
            const isBright = intensity > 0.6;
            const starColors = [
              'rgba(255, 255, 255, 1)',
              'rgba(168, 85, 247, 1)',
              'rgba(192, 132, 252, 1)',
            ];
            const colorIndex = Math.floor(Math.random() * starColors.length);
            const starColor = starColors[colorIndex];

            return {
              id: i,
              x: Math.random() * 100,
              y: Math.random() * 100,
              size: isBright ? Math.random() * 1.5 + 0.8 : Math.random() * 1 + 0.5,
              opacity: isBright ? Math.random() * 0.6 + 0.3 : Math.random() * 0.4 + 0.2,
              duration: Math.random() * 4 + 2,
              delay: Math.random() * 3,
              color: starColor,
            };
          });

          return (
            <button
              key="other"
              onClick={() => {
                // Route to talk to us page
                router.push('/talk');
              }}
              className="touch-manipulation relative overflow-hidden"
              style={{
                padding: '1.5rem 2.5rem',
                borderRadius: '24px',
                border: `2px solid ${colors.accent}`,
                backgroundColor: 'transparent',
                color: colors.text,
                fontSize: '1.1rem',
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: isVisible ? 0.8 : 0,
                transform: isVisible ? 'translateX(0) translateY(0) scale(1)' : 'translateX(-20px) translateY(-5px) scale(1)',
                whiteSpace: 'normal',
                width: '100%',
                boxShadow: `0 0 15px ${colors.accent}30`,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = `0 0 25px ${colors.accent}60, 0 0 50px ${colors.accent}40, 0 0 75px ${colors.accent}25`;
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = `0 0 15px ${colors.accent}30`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {/* Stars inside the "Other" box */}
              {otherStars.map((star) => {
                const glowSize = star.opacity > 0.4 ? star.size * 3 : star.size * 2;
                const glowOpacity = star.opacity > 0.4 ? 0.6 : 0.4;
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
                      zIndex: 0,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
              <span style={{ position: 'relative', zIndex: 1 }}>
                Other
              </span>
            </button>
          );
        })()}
      </div>
    </div>
  );
}

