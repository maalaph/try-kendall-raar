'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

// Add-on prices (matching PricingSummary)
const addOnPrices: Record<string, number> = {
  'reminder-confirmation': 99.99,
  'post-appointment': 29.99,
  'waitlist-autofill': 19.99,
  'consultation-prescreening': 49,
  'high-ticket-nurture': 69,
  'canceled-appointment-recovery': 39,
  'maintenance-plan-upsell': 49,
  'class-reminder-system': 39,
  'dormant-member-reengagement': 49,
};

interface AddOnsStepProps {
  businessType: string | null;
  selectedAddOns: string[];
  onToggleAddOn: (id: string) => void;
  shouldAnimate?: boolean;
  onAddOnHover?: (addOnId: string | null) => void;
  justToggledAddOnId?: string | null;
}

export default function AddOnsStep({
  businessType,
  selectedAddOns,
  onToggleAddOn,
  shouldAnimate = false,
  onAddOnHover,
  justToggledAddOnId,
}: AddOnsStepProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [titleVisible, setTitleVisible] = useState(false);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const [justToggled, setJustToggled] = useState<string | null>(null);

  const typeData = getBusinessTypeData(businessType);
  const addOns = typeData?.addOns || [];

  useEffect(() => {
    if (businessType) {
      if (shouldAnimate) {
        setTitleVisible(false);
        setVisibleItems([]);
        // Calculate delay based on Standard Features and Also Includes count to continue the cascade
        const currentTypeData = getBusinessTypeData(businessType);
        const standardFeaturesCount = currentTypeData?.standardFeatures?.length || 0;
        const alsoIncludesCount = currentTypeData?.alsoIncludes?.length || 0;
        const currentAddOns = currentTypeData?.addOns || [];
        const baseDelay = (standardFeaturesCount * 100) + (alsoIncludesCount * 100) + 400; // Start after previous sections finish
        // Animate title first
        setTimeout(() => setTitleVisible(true), baseDelay);
        // Then animate cards
        const timers = currentAddOns.map((_, index) => {
          return setTimeout(() => {
            setVisibleItems((prev) => [...prev, index]);
          }, baseDelay + 200 + (index * 120));
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

  const handleToggle = (addOnId: string) => {
    onToggleAddOn(addOnId);
    setJustToggled(addOnId);
    // Reset the toggle effect after animation
    setTimeout(() => setJustToggled(null), 500);
  };

  if (!businessType || !typeData || addOns.length === 0) {
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
        Add-Ons
      </h3>
      <div className="space-y-3">
        {addOns.map((addOn, index) => {
          const isSelected = selectedAddOns.includes(addOn.id);
          const isExpanded = expandedCards.has(addOn.id);
          const isVisible = visibleItems.includes(index);
          const price = addOnPrices[addOn.id] || 0;

          return (
            <div
              key={addOn.id}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible 
                  ? (justToggled === addOn.id && isSelected 
                      ? 'translateX(0) translateY(-8px) scale(1.03)' 
                      : isSelected 
                      ? 'translateX(0) translateY(-4px) scale(1.01)' 
                      : 'translateX(0) translateY(0)')
                  : 'translateX(-30px) translateY(-5px)',
                transition: 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), boxShadow 0.4s ease, border 0.3s ease, background-color 0.3s ease',
                border: `2px solid ${isSelected ? colors.accent : `${colors.accent}40`}`,
                borderRadius: '12px',
                padding: '1.5rem',
                backgroundColor: isSelected ? `${colors.accent}20` : 'transparent',
                cursor: 'pointer',
                boxShadow: isSelected 
                  ? `0 0 25px ${colors.accent}30, 0 4px 20px ${colors.accent}20`
                  : `0 2px 8px ${colors.accent}10`,
                position: 'relative',
                overflow: 'visible',
                zIndex: 10,
                pointerEvents: 'auto',
              }}
              onClick={() => {
                setExpandedCards((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(addOn.id)) {
                    newSet.delete(addOn.id);
                  } else {
                    newSet.add(addOn.id);
                  }
                  return newSet;
                });
              }}
              onMouseEnter={(e) => {
                if (onAddOnHover) onAddOnHover(addOn.id);
                if (isSelected) {
                  e.currentTarget.style.boxShadow = `0 0 60px ${colors.accent}70, 0 10px 50px ${colors.accent}50, 0 0 80px ${colors.accent}40`;
                  e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                  e.currentTarget.style.borderColor = colors.accent;
                } else {
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}40, 0 4px 15px ${colors.accent}20`;
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                  e.currentTarget.style.borderColor = `${colors.accent}70`;
                  e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (onAddOnHover) onAddOnHover(null);
                if (isSelected) {
                  e.currentTarget.style.boxShadow = `0 0 25px ${colors.accent}30, 0 4px 20px ${colors.accent}20`;
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                } else {
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}10`;
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = `${colors.accent}40`;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3
                    style={{
                      color: colors.text,
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {addOn.title}
                  </h3>
                  {price > 0 && (
                    <span
                      style={{
                        color: colors.accent,
                        fontSize: '1rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      ${price.toFixed(2)}/mo
                    </span>
                  )}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(addOn.id);
                  }}
                  style={{
                    width: '56px',
                    height: '32px',
                    borderRadius: '16px',
                    backgroundColor: isSelected ? colors.accent : `${colors.accent}30`,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: isSelected 
                      ? `0 0 25px ${colors.accent}70, 0 0 45px ${colors.accent}50, 0 0 65px ${colors.accent}30`
                      : `0 2px 8px ${colors.accent}20`,
                    transform: justToggled === addOn.id && isSelected 
                      ? 'scale(1.1)' 
                      : justToggled === addOn.id && !isSelected
                      ? 'scale(0.95)'
                      : 'scale(1)',
                    border: `2px solid ${isSelected ? colors.accent : 'transparent'}`,
                  }}
                  onMouseEnter={(e) => {
                    if (isSelected) {
                      e.currentTarget.style.boxShadow = `0 0 35px ${colors.accent}80, 0 0 55px ${colors.accent}60, 0 0 75px ${colors.accent}40`;
                      e.currentTarget.style.transform = 'scale(1.08)';
                    } else {
                      e.currentTarget.style.boxShadow = `0 0 25px ${colors.accent}70, 0 0 40px ${colors.accent}50`;
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.backgroundColor = `${colors.accent}50`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) {
                      e.currentTarget.style.boxShadow = `0 0 25px ${colors.accent}70, 0 0 45px ${colors.accent}50, 0 0 65px ${colors.accent}30`;
                      e.currentTarget.style.transform = 'scale(1)';
                    } else {
                      e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}20`;
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                    }
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: isSelected ? '22px' : '2px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: colors.text,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      boxShadow: isSelected 
                        ? `0 0 15px ${colors.accent}, 0 0 25px ${colors.accent}60, 0 2px 8px rgba(0,0,0,0.4)`
                        : '0 2px 6px rgba(0,0,0,0.3)',
                      transform: justToggled === addOn.id && isSelected 
                        ? 'scale(1.2)' 
                        : justToggled === addOn.id && !isSelected
                        ? 'scale(0.9)'
                        : 'scale(1)',
                      zIndex: 2,
                    }}
                  />
                  
                  {/* Subtle glow effect when toggled ON */}
                  {justToggled === addOn.id && isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${colors.accent}40 0%, transparent 70%)`,
                        animation: 'toggle-glow 0.5s ease-out forwards',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}
                </div>
              </div>
              <p
                style={{
                  color: colors.text,
                  opacity: 0.8,
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-inter), sans-serif',
                  marginBottom: isExpanded && addOn.includes && addOn.includes.length > 0 ? '1rem' : 0,
                }}
              >
                {addOn.description}
              </p>
              {isExpanded && addOn.includes && addOn.includes.length > 0 && (
                <ul className="space-y-2 mt-2" style={{ listStyle: 'none', padding: 0 }}>
                  {addOn.includes.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span style={{ color: colors.accent, fontSize: '0.875rem', lineHeight: '1.5' }}>•</span>
                      <span
                        style={{
                          color: colors.text,
                          opacity: 0.9,
                          fontSize: '0.875rem',
                          fontFamily: 'var(--font-inter), sans-serif',
                          lineHeight: '1.5',
                        }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
