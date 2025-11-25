'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

interface AlsoIncludesStepProps {
  businessType: string | null;
  shouldAnimate?: boolean;
}

export default function AlsoIncludesStep({ businessType, shouldAnimate = false }: AlsoIncludesStepProps) {
  const [titleVisible, setTitleVisible] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  
  const typeData = getBusinessTypeData(businessType);
  const alsoIncludes = typeData?.alsoIncludes || [];

  useEffect(() => {
    if (businessType) {
      if (shouldAnimate) {
        setTitleVisible(false);
        setVisibleItems([]);
        // Calculate delay based on Standard Features count to continue the cascade
        const currentTypeData = getBusinessTypeData(businessType);
        const standardFeaturesCount = currentTypeData?.standardFeatures?.length || 0;
        const currentAlsoIncludes = currentTypeData?.alsoIncludes || [];
        const baseDelay = standardFeaturesCount * 100 + 300; // Start after Standard Features finish
        // Animate title first
        setTimeout(() => setTitleVisible(true), baseDelay);
        // Then animate items
        const timers = currentAlsoIncludes.map((_, index) => {
          return setTimeout(() => {
            setVisibleItems((prev) => [...prev, index]);
          }, baseDelay + 200 + (index * 100));
        });
        return () => {
          timers.forEach((timer) => clearTimeout(timer));
        };
      } else {
        // Keep hidden until animation starts
        setTitleVisible(false);
        setVisibleItems([]);
      }
    }
  }, [businessType, shouldAnimate]);

  if (!businessType || !typeData || alsoIncludes.length === 0) {
    return null;
  }

  // Hide entire section until title is ready to show
  const sectionVisible = titleVisible || visibleItems.length > 0;

  return (
    <div 
      className="w-full"
      style={{
        opacity: sectionVisible ? 1 : 0,
        transform: sectionVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
        transition: 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: sectionVisible ? 'auto' : 'none',
      }}
    >
      <h3
        style={{
          color: colors.text,
          fontSize: '1.25rem',
          fontWeight: 500,
          fontFamily: 'var(--font-inter), sans-serif',
          marginBottom: '0.75rem',
          marginTop: '0',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
          transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        Also Includes
      </h3>

      <div
        className="rounded-xl"
        style={{
          border: `2px solid ${colors.accent}40`,
          backgroundColor: `${colors.accent}10`,
          padding: '0.875rem 1rem',
          minHeight: titleVisible ? 'auto' : '0',
          overflow: 'hidden',
        }}
      >
        <ul className="space-y-3" style={{ listStyle: 'none', padding: 0 }}>
          {alsoIncludes.map((item, index) => {
            const isVisible = visibleItems.includes(index);
            return (
              <li
                key={index}
                className="flex items-start gap-3"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
                  transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <span
                  style={{
                    color: colors.text,
                    opacity: 0.9,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                  }}
                >
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

