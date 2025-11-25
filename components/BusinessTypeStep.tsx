'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { businessTypeIds, businessTypesData } from '@/lib/businessTypes';

interface BusinessTypeStepProps {
  selectedType: string | null;
  onSelect: (type: string) => void;
  shouldAnimate?: boolean;
}

export default function BusinessTypeStep({
  selectedType,
  onSelect,
  shouldAnimate = false,
}: BusinessTypeStepProps) {
  const [headerVisible, setHeaderVisible] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<number[]>([]);

  useEffect(() => {
    if (shouldAnimate) {
      // Animate header first
      setTimeout(() => setHeaderVisible(true), 100);
      
      // Then animate business types sequentially
      businessTypeIds.forEach((_, index) => {
        setTimeout(() => {
          setVisibleTypes((prev) => [...prev, index]);
        }, 300 + (index * 100));
      });
    } else {
      setHeaderVisible(true);
      setVisibleTypes(businessTypeIds.map((_, i) => i));
    }
  }, [shouldAnimate]);

  return (
    <div className="w-full" style={{ 
      minHeight: selectedType ? '60px' : '200px',
      transition: 'min-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      <div 
        className={selectedType ? "flex gap-3 sm:gap-4 overflow-x-auto pb-2" : "flex flex-col gap-3 sm:gap-4"}
        style={{
          scrollbarWidth: selectedType ? 'thin' : 'none',
          scrollbarColor: `${colors.accent}40 transparent`,
          position: 'relative',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
              className={selectedType ? "touch-manipulation flex-shrink-0" : "touch-manipulation"}
              style={{
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                border: `2px solid ${isSelected ? colors.accent : `${colors.accent}40`}`,
                backgroundColor: isSelected ? `${colors.accent}15` : 'transparent',
                color: colors.text,
                fontSize: '0.95rem',
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                opacity: isVisible ? (isSelected ? 1 : 0.6) : 0,
                transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
                whiteSpace: selectedType ? 'nowrap' : 'normal',
                flexShrink: selectedType ? 0 : 1,
                width: selectedType ? 'auto' : '100%',
                boxShadow: isSelected ? `0 0 30px ${colors.accent}50` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = '0.8';
                  e.currentTarget.style.borderColor = `${colors.accent}60`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.borderColor = `${colors.accent}40`;
                }
              }}
            >
              {typeData.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

