'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

interface StandardFeaturesStepProps {
  businessType: string | null;
  shouldAnimate?: boolean;
}

export default function StandardFeaturesStep({ businessType, shouldAnimate = false }: StandardFeaturesStepProps) {
  const [titleVisible, setTitleVisible] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  
  const typeData = getBusinessTypeData(businessType);
  const standardFeatures = typeData?.standardFeatures || [];

  useEffect(() => {
    if (businessType) {
      if (shouldAnimate) {
        setTitleVisible(false);
        setVisibleItems([]);
        // Get current data inside effect
        const currentTypeData = getBusinessTypeData(businessType);
        const currentStandardFeatures = currentTypeData?.standardFeatures || [];
        // Animate title first
        setTimeout(() => setTitleVisible(true), 150);
        // Then animate items with smooth cascade
        const timers = currentStandardFeatures.map((_, index) => {
          return setTimeout(() => {
            setVisibleItems((prev) => [...prev, index]);
          }, 300 + (index * 80));
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
  }, [shouldAnimate, businessType]);

  if (!businessType || !typeData || standardFeatures.length === 0) {
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
          fontSize: '1.125rem',
          fontWeight: 500,
          fontFamily: 'var(--font-inter), sans-serif',
          marginBottom: '0.75rem',
          marginTop: '0',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
          transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        Standard Features
      </h3>

      <div
        style={{
          border: `2px solid ${colors.accent}40`,
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          backgroundColor: 'transparent',
          boxShadow: `0 2px 8px ${colors.accent}10`,
          minHeight: titleVisible ? 'auto' : '0',
          overflow: 'hidden',
        }}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {standardFeatures.map((feature, index) => {
            const isVisible = visibleItems.includes(index);
            return (
              <li
                key={index}
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(-20px) translateY(-5px)',
                  transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  marginBottom: index < standardFeatures.length - 1 ? '0.5rem' : 0,
                }}
              >
                <span
                  style={{
                    color: colors.text,
                    opacity: 0.9,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '0.95rem',
                    lineHeight: '1.28',
                    display: 'block',
                  }}
                >
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

