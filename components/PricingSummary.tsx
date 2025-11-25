'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

interface PricingSummaryProps {
  businessType: string | null;
  callVolume: string | null;
  callDuration: string | null;
  selectedAddOns: string[];
  onStartTrial: () => void;
  shouldAnimate?: boolean;
}

// Pricing packages with fixed monthly prices
interface PricingPackage {
  id: string;
  name: string;
  maxMinutes: number;
  monthlyPrice: number;
}

const PRICING_PACKAGES: PricingPackage[] = [
  { id: 'starter', name: 'Starter', maxMinutes: 500, monthlyPrice: 199.99 },
  { id: 'growth', name: 'Growth', maxMinutes: 1500, monthlyPrice: 549.99 },
  { id: 'professional', name: 'Professional', maxMinutes: 4000, monthlyPrice: 1199.99 },
  { id: 'enterprise', name: 'Enterprise', maxMinutes: Infinity, monthlyPrice: 2499.99 },
];

// Calculate total minutes per month
// Assumes 30 business days per month
const calculateTotalMinutes = (callVolume: string | null, callDuration: string | null): number => {
  if (!callVolume || !callDuration) return 0;
  const volume = parseFloat(callVolume);
  const duration = parseFloat(callDuration);
  if (isNaN(volume) || isNaN(duration)) return 0;
  // Total minutes = calls per day × minutes per call × 30 days
  return volume * duration * 30;
};

// Determine recommended package based on total minutes
const getRecommendedPackage = (totalMinutes: number): PricingPackage => {
  for (const pkg of PRICING_PACKAGES) {
    if (totalMinutes <= pkg.maxMinutes) {
      return pkg;
    }
  }
  return PRICING_PACKAGES[PRICING_PACKAGES.length - 1]; // Enterprise
};

// Add-on prices (matching the structure from businessTypes)
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

const PHONE_LINE_PRICE = 17.99;

export default function PricingSummary({
  businessType,
  callVolume,
  callDuration,
  selectedAddOns,
  onStartTrial,
  shouldAnimate = false,
}: PricingSummaryProps) {
  const router = useRouter();
  const [phoneLines, setPhoneLines] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Restore phoneLines from sessionStorage if returning from pricing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('wizardState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.phoneLines !== undefined) {
            setPhoneLines(state.phoneLines);
          }
        } catch (e) {
          console.error('Failed to restore phoneLines:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (businessType) {
      if (shouldAnimate) {
        setIsVisible(false);
        // Animate after KendallPowerUps (4000ms) + 500ms delay
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 4500);
        return () => clearTimeout(timer);
      } else {
        // Keep hidden until animation starts
        setIsVisible(false);
      }
    }
  }, [businessType, shouldAnimate]);

  const totalMinutes = calculateTotalMinutes(callVolume, callDuration);
  const recommendedPackage = getRecommendedPackage(totalMinutes);
  const isEnterprise = recommendedPackage.id === 'enterprise';
  const basePrice = recommendedPackage.monthlyPrice;

  const addOnTotal = selectedAddOns.reduce((sum, addOnId) => {
    return sum + (addOnPrices[addOnId] || 0);
  }, 0);
  const phoneLinesTotal = phoneLines * PHONE_LINE_PRICE;
  const totalPrice = basePrice + addOnTotal + phoneLinesTotal;

  const typeData = getBusinessTypeData(businessType);
  const addOns = typeData?.addOns || [];

  const handlePlanClick = () => {
    // Save wizard state to sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wizardState', JSON.stringify({
        businessType,
        callVolume,
        callDuration,
        selectedAddOns,
        phoneLines,
      }));
      sessionStorage.setItem('returningFromPricing', 'true');
    }
    // Navigate to pricing page with plan hash
    router.push(`/pricing#${recommendedPackage.id}`);
  };

  return (
    <div
      className="rounded-xl"
      style={{
        border: `2px solid ${colors.accent}40`,
        backgroundColor: `${colors.accent}10`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(30px) translateY(-10px)',
        transition: 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        padding: 'clamp(1.5rem, 2.5vw, 2rem)',
        overflow: 'visible',
        minHeight: 'fit-content',
        width: '100%',
      }}
    >
      <h3
        style={{
          color: colors.text,
          fontSize: '1.125rem',
          fontWeight: 500,
          fontFamily: 'var(--font-inter), sans-serif',
          marginBottom: '1.25rem',
        }}
      >
        Price Breakdown
      </h3>

      <div className="space-y-2.5" style={{ marginBottom: '1.5rem', minHeight: 'fit-content' }}>
        {/* Recommended Package */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: '0.5rem' }}>
          <div className="flex items-center justify-between">
            <span
              style={{
                color: colors.text,
                opacity: 0.9,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '0.875rem',
              }}
            >
              Recommended Plan:{' '}
              <span
                onClick={handlePlanClick}
                style={{
                  color: colors.accent,
                  fontWeight: 600,
                  borderBottom: '1px dotted',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {recommendedPackage.name}
              </span>
            </span>
            {!isEnterprise && (
              <span
                style={{
                  color: colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                ${basePrice.toFixed(2)}/mo
              </span>
            )}
          </div>
        </div>

        {/* Add-On Prices */}
        {selectedAddOns.map((addOnId) => {
          const addOn = addOns.find((a) => a.id === addOnId);
          const price = addOnPrices[addOnId] || 0;
          if (!addOn || price === 0) return null;
          
          return (
            <div key={addOnId} className="flex items-center justify-between">
              <span
                style={{
                  color: colors.text,
                  opacity: 0.9,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                {addOn.title}
              </span>
              <span
                style={{
                  color: colors.accent,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                +${price.toFixed(2)}/mo
              </span>
            </div>
          );
        })}

        {/* Phone Lines */}
        <div className="flex items-center justify-between pt-2.5" style={{ borderTop: `1px solid ${colors.accent}40`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
            <div className="flex items-center gap-2">
              <span
                style={{
                  color: colors.text,
                  opacity: 0.9,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                Extra Phone Lines
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhoneLines(Math.max(0, phoneLines - 1))}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: `1px solid ${colors.accent}60`,
                    backgroundColor: 'transparent',
                    color: colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-inter), sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = `${colors.accent}60`;
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    color: colors.text,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {phoneLines}
                </span>
                <button
                  type="button"
                  onClick={() => setPhoneLines(phoneLines + 1)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: `1px solid ${colors.accent}60`,
                    backgroundColor: 'transparent',
                    color: colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-inter), sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = `${colors.accent}60`;
                  }}
                >
                  +
                </button>
              </div>
            </div>
            {phoneLines > 0 && (
              <span
                style={{
                  color: colors.accent,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                +${phoneLinesTotal.toFixed(2)}/mo
              </span>
            )}
          </div>

        {/* Total */}
        {!isEnterprise && (
          <div
            className="flex items-center justify-between pt-2.5"
            style={{
              borderTop: `1px solid ${colors.accent}40`,
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
            }}
          >
            <span
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Total Monthly Price
            </span>
            <span
              style={{
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '1.25rem',
                fontWeight: 700,
              }}
            >
              ${totalPrice.toFixed(2)}/mo
            </span>
          </div>
        )}
      </div>

      {/* CTA Button */}
      <div className="flex flex-col items-center gap-2">
        {isEnterprise ? (
          <a
            href="/talk"
            className="group relative flex items-center justify-center touch-manipulation w-full"
            style={{
              color: colors.text,
              backgroundColor: colors.accent,
              border: `2px solid ${colors.accent}`,
              borderRadius: '10px',
              padding: '0.875rem 1.5rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              fontFamily: 'var(--font-inter), sans-serif',
              cursor: 'pointer',
              minHeight: '48px',
              transition: 'all 0.25s ease',
              boxShadow: `0 0 30px ${colors.accent}70, 0 0 60px ${colors.accent}50, 0 0 90px ${colors.accent}30`,
              textDecoration: 'none',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}90, 0 0 80px ${colors.accent}70, 0 0 120px ${colors.accent}50, 0 0 160px ${colors.accent}30`;
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}70, 0 0 60px ${colors.accent}50, 0 0 90px ${colors.accent}30`;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Contact for info
          </a>
        ) : (
          <>
            <button
              onClick={onStartTrial}
              className="group relative flex items-center justify-center touch-manipulation w-full"
              style={{
                color: colors.text,
                backgroundColor: colors.accent,
                border: `2px solid ${colors.accent}`,
                borderRadius: '10px',
                padding: '0.875rem 1.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                cursor: 'pointer',
                minHeight: '48px',
                transition: 'all 0.25s ease',
                boxShadow: `0 0 30px ${colors.accent}70, 0 0 60px ${colors.accent}50, 0 0 90px ${colors.accent}30`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}90, 0 0 80px ${colors.accent}70, 0 0 120px ${colors.accent}50, 0 0 160px ${colors.accent}30`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}70, 0 0 60px ${colors.accent}50, 0 0 90px ${colors.accent}30`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Start Free Trial
            </button>
            <p
              style={{
                color: colors.text,
                opacity: 0.7,
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-inter), sans-serif',
                margin: 0,
              }}
            >
              No credit card required
            </p>
          </>
        )}
      </div>
    </div>
  );
}

