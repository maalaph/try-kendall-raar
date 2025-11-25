'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { colors } from '@/lib/config';
import { businessTypesData } from '@/lib/businessTypes';
import { ChevronDown, ChevronUp } from 'lucide-react';

const BUY_PERSONAL_URL = process.env.NEXT_PUBLIC_KENDALL_PERSONAL_URL || 'https://buy.stripe.com/cNi14n8968x6gOB8LocQU00';

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

const PHONE_LINE_PRICE = 17.99;

export default function PricingPage() {
  const [isClient, setIsClient] = useState(false);
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);
  const [expandedAddOnSections, setExpandedAddOnSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle URL hash to highlight specific plan
  useEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['starter', 'growth', 'professional', 'enterprise'].includes(hash)) {
        setHighlightedPlan(hash);
        // Scroll to the plan after a short delay to ensure DOM is ready
        setTimeout(() => {
          const element = document.getElementById(`plan-${hash}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Remove highlight after 3 seconds
            setTimeout(() => {
              setHighlightedPlan(null);
              // Remove hash from URL
              window.history.replaceState(null, '', window.location.pathname);
            }, 3000);
          }
        }, 100);
      }
    }
  }, [isClient]);

  // Group add-ons by business type
  const addOnsByBusinessType = Object.entries(businessTypesData).map(([typeId, typeData]) => ({
    businessTypeName: typeData.name,
    addOns: typeData.addOns
      .filter((addOn) => addOnPrices[addOn.id] && addOnPrices[addOn.id] > 0)
      .map((addOn) => ({
        id: addOn.id,
        title: addOn.title,
        price: addOnPrices[addOn.id],
      })),
  })).filter((group) => group.addOns.length > 0);

  // Personal plan
  const PERSONAL_PLAN = {
    id: 'personal',
    name: 'Personal',
    pricePerMinute: 0.35,
    description: 'Perfect for personal use',
    features: [
      '24/7 AI receptionist',
      'Unlimited calls',
      'Custom voice training',
      'Calendar integration',
      'Priority support'
    ]
  };

  const toggleAddOnSection = (sectionName: string) => {
    setExpandedAddOnSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName);
      } else {
        newSet.add(sectionName);
      }
      return newSet;
    });
  };

  const handlePersonalBuyClick = () => {
    window.open(BUY_PERSONAL_URL, '_blank');
  };

  // Business pricing packages
  const BUSINESS_PACKAGES = [
    { 
      id: 'starter', 
      name: 'Starter', 
      maxMinutes: 500, 
      overageRate: 0.40,
      description: 'Perfect for small businesses just getting started',
      idealFor: ['Solo practitioners', 'New businesses'],
      maxPrice: 199.99
    },
    { 
      id: 'growth', 
      name: 'Growth', 
      maxMinutes: 1500, 
      overageRate: 0.40,
      description: 'Ideal for growing businesses with moderate call volume',
      idealFor: ['Small teams', 'Expanding operations'],
      maxPrice: 549.99
    },
    { 
      id: 'professional', 
      name: 'Professional', 
      maxMinutes: 4000, 
      overageRate: 0.40,
      description: 'For established businesses with steady call volume',
      idealFor: ['Established businesses', 'Multiple staff'],
      maxPrice: 1199.99
    },
  ];

  // Enterprise plan
  const ENTERPRISE_PLAN = {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Tailored solutions for enterprise needs',
    pricePerMinute: 0.40
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes === Infinity) return 'Unlimited';
    if (minutes < 1000) return `${Math.round(minutes)} min`;
    return `${(minutes / 1000).toFixed(1)}k min`;
  };

  return (
    <div
      className="w-full flex flex-col items-center"
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        zIndex: 20,
        padding: 0,
        margin: 0,
      }}
    >
      {/* Main Pricing Layout */}
      <div 
        className="w-full"
        style={{ 
          marginBottom: '4rem', 
          margin: '0 0 3rem 0'
        }}
      >
        {/* Desktop: Layout with Personal on left, Business plans on right */}
        <div 
          className="hidden lg:flex"
          style={{ 
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            width: '100%',
            paddingLeft: 'clamp(2rem, 8vw, 10rem)',  // Match navbar logo left padding
            paddingRight: 'clamp(2rem, 8vw, 10rem)', // Match navbar right padding
            paddingTop: '4rem'                        // pushes the Personal block under "raar."
          }}
        >
          {/* Left Column: Personal Plan */}
          <div 
            style={{ 
              width: '25%', 
              minWidth: '280px', 
              maxWidth: '340px',
              marginLeft: '0',       // forces it to hug the left under the logo
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3
              style={{
                color: colors.text,
                fontSize: '1.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                marginBottom: '1.25rem',
                marginTop: '0', // Align with Business Plans header
              }}
            >
              Personal
            </h3>
            <div
              className="flex flex-col"
              style={{
                borderRadius: '16px',
                border: `2px solid ${colors.accent}40`,
                backgroundColor: `${colors.accent}10`,
                padding: '2rem',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                flex: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${colors.accent}40`;
                e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <h4
                style={{
                  color: colors.text,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-inter), sans-serif',
                  marginBottom: '0.5rem',
                  lineHeight: '1.2',
                }}
              >
                {PERSONAL_PLAN.name}
              </h4>
              <p
                style={{
                  color: colors.text,
                  opacity: 0.8,
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-inter), sans-serif',
                  marginBottom: '1.5rem',
                  lineHeight: '1.5',
                }}
              >
                {PERSONAL_PLAN.description}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <span
                  style={{
                    color: colors.accent,
                    fontSize: '3.5rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-inter), sans-serif',
                    lineHeight: '1',
                  }}
                >
                  ${PERSONAL_PLAN.pricePerMinute.toFixed(2)}
                </span>
                <span
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    color: colors.text,
                    opacity: 0.8,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  /min
                </span>
              </div>
              {/* BUY NOW Button */}
              <button
                onClick={handlePersonalBuyClick}
                className="group relative flex items-center justify-center overflow-visible w-full touch-manipulation transition-all duration-300"
                style={{
                  color: colors.text,
                  backgroundColor: colors.accent,
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '1.5rem 2rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  cursor: 'pointer',
                  minWidth: 'auto',
                  minHeight: '64px',
                  boxShadow: `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`,
                  outline: 'none',
                  textShadow: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '1.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 50px rgba(168, 85, 247, 0.9), 0 0 100px rgba(168, 85, 247, 0.7), 0 0 150px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
              >
                <span style={{ position: 'relative', zIndex: 2, fontWeight: 700 }}>
                  BUY NOW
                </span>
              </button>
              <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${colors.accent}30` }}>
                <p
                  style={{
                    color: colors.text,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-inter), sans-serif',
                    marginBottom: '0.75rem',
                    opacity: 0.9,
                  }}
                >
                  Features:
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {PERSONAL_PLAN.features.map((feature, idx) => (
                    <li
                      key={idx}
                      style={{
                        color: colors.text,
                        opacity: 0.85,
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-inter), sans-serif',
                        marginBottom: '0.5rem',
                        paddingLeft: '1rem',
                        position: 'relative',
                        lineHeight: '1.5',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          color: colors.accent,
                          opacity: 0.8,
                          fontSize: '1rem',
                          top: '0.125rem',
                        }}
                      >
                        •
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Business Plans */}
          <div style={{ width: '75%', maxWidth: '960px', marginLeft: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Free Trial CTA */}
            <p style={{
              color: colors.text,
              fontSize: '0.875rem',
              fontFamily: 'var(--font-inter), sans-serif',
              opacity: 0.9,
              lineHeight: '1.6',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <span>Free Trial. No Credit Card Required. </span>
              <Link 
                href="/book"
                style={{
                  color: colors.accent,
                  textDecoration: 'none',
                  fontWeight: 600,
                  borderBottom: `1px solid ${colors.accent}60`,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = colors.accent;
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = `${colors.accent}60`;
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Your Recommended Plan
              </Link>
            </p>

            <h3
              style={{
                color: colors.text,
                fontSize: '1.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                marginBottom: '1.25rem',
                marginTop: '0', // Align with Personal header
              }}
            >
              Business Plans
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Top Row: Starter, Growth, Professional - Three cards side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', width: '100%', gridAutoRows: '1fr' }}>
                {BUSINESS_PACKAGES.map((pkg) => {
                  const isHighlighted = highlightedPlan === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      id={`plan-${pkg.id}`}
                      className="flex flex-col"
                      style={{
                        borderRadius: '16px',
                        border: isHighlighted ? `3px solid ${colors.accent}` : `2px solid ${colors.accent}40`,
                        backgroundColor: isHighlighted ? `${colors.accent}20` : `${colors.accent}10`,
                        padding: '2rem',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        height: '100%',
                        boxShadow: isHighlighted ? `0 0 40px ${colors.accent}50, 0 8px 32px ${colors.accent}40` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.accent;
                        e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${colors.accent}40`;
                        e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <h4
                        style={{
                          color: colors.text,
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-inter), sans-serif',
                          marginBottom: '0.5rem',
                          lineHeight: '1.2',
                        }}
                      >
                        {pkg.name}
                      </h4>
                      <p
                        style={{
                          color: colors.text,
                          opacity: 0.8,
                          fontSize: '0.9375rem',
                          fontFamily: 'var(--font-inter), sans-serif',
                          marginBottom: '1.5rem',
                          lineHeight: '1.5',
                        }}
                      >
                        {pkg.description}
                      </p>
                      <div
                        style={{
                          color: colors.accent,
                          fontSize: '2rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-inter), sans-serif',
                          marginBottom: '0.75rem',
                          lineHeight: '1.2',
                        }}
                      >
                        ${pkg.maxPrice.toFixed(2)}
                        <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.8, marginLeft: '0.25rem' }}>/mo</span>
                      </div>
                      <p
                        style={{
                          color: colors.text,
                          opacity: 0.75,
                          fontSize: '0.875rem',
                          fontFamily: 'var(--font-inter), sans-serif',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Up to {formatMinutes(pkg.maxMinutes)}/month
                      </p>
                      <p
                        style={{
                          color: colors.accent,
                          opacity: 0.9,
                          fontSize: '0.875rem',
                          fontFamily: 'var(--font-inter), sans-serif',
                          fontWeight: 500,
                          marginBottom: '1.5rem',
                        }}
                      >
                        Overage rate: ${pkg.overageRate.toFixed(2)}/minute
                      </p>
                      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${colors.accent}30` }}>
                        <p
                          style={{
                            color: colors.text,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-inter), sans-serif',
                            marginBottom: '0.75rem',
                            opacity: 0.9,
                          }}
                        >
                          Ideal for:
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {pkg.idealFor.map((item, idx) => (
                            <li
                              key={idx}
                              style={{
                                color: colors.text,
                                opacity: 0.85,
                                fontSize: '0.875rem',
                                fontFamily: 'var(--font-inter), sans-serif',
                                marginBottom: '0.5rem',
                                paddingLeft: '1rem',
                                position: 'relative',
                                lineHeight: '1.5',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  color: colors.accent,
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  top: '0.125rem',
                                }}
                              >
                                •
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enterprise Plan - Horizontal Rectangle spanning width of three business cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', width: '100%' }}>
                <Link
                  id="plan-enterprise"
                  href="/talk"
                  style={{
                    gridColumn: '1 / -1',
                    borderRadius: '16px',
                    border: highlightedPlan === 'enterprise' ? `3px solid ${colors.accent}` : `2px solid ${colors.accent}40`,
                    backgroundColor: highlightedPlan === 'enterprise' ? `${colors.accent}20` : `${colors.accent}10`,
                    padding: '2rem',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    marginTop: '0',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    boxShadow: highlightedPlan === 'enterprise' ? `0 0 40px ${colors.accent}50, 0 8px 32px ${colors.accent}40` : 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${colors.accent}40`;
                    e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h4
                      style={{
                        color: colors.text,
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-inter), sans-serif',
                        marginBottom: '0.5rem',
                        lineHeight: '1.2',
                      }}
                    >
                      {ENTERPRISE_PLAN.name}
                    </h4>
                    <p
                      style={{
                        color: colors.text,
                        opacity: 0.75,
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-inter), sans-serif',
                        lineHeight: '1.4',
                      }}
                    >
                      {ENTERPRISE_PLAN.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '2rem' }}>
                    <p
                      style={{
                        color: colors.accent,
                        fontSize: '1rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      Custom setup meeting required
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Tablet/Mobile: Stacked layout */}
        <div className="lg:hidden flex flex-col gap-8">
          {/* Personal Plan */}
          <div>
            <h3
              style={{
                color: colors.text,
                fontSize: '1.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                marginBottom: '1.25rem',
              }}
            >
              Personal
            </h3>
            <div
              className="flex flex-col"
              style={{
                borderRadius: '16px',
                border: `2px solid ${colors.accent}40`,
                backgroundColor: `${colors.accent}10`,
                padding: '2rem',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${colors.accent}40`;
                e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <h4
                style={{
                  color: colors.text,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-inter), sans-serif',
                  marginBottom: '0.5rem',
                  lineHeight: '1.2',
                }}
              >
                {PERSONAL_PLAN.name}
              </h4>
              <p
                style={{
                  color: colors.text,
                  opacity: 0.75,
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-inter), sans-serif',
                  marginBottom: '1.5rem',
                  lineHeight: '1.4',
                }}
              >
                {PERSONAL_PLAN.description}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <span
                  style={{
                    color: colors.accent,
                    fontSize: '3.5rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-inter), sans-serif',
                    lineHeight: '1',
                  }}
                >
                  ${PERSONAL_PLAN.pricePerMinute.toFixed(2)}
                </span>
                <span
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    color: colors.text,
                    opacity: 0.8,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  /min
                </span>
              </div>
              {/* BUY NOW Button */}
              <button
                onClick={handlePersonalBuyClick}
                className="group relative flex items-center justify-center overflow-visible w-full touch-manipulation transition-all duration-300"
                style={{
                  color: colors.text,
                  backgroundColor: colors.accent,
                  border: `2px solid ${colors.accent}`,
                  borderRadius: '12px',
                  padding: '1.5rem 2rem',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-league-spartan), sans-serif',
                  cursor: 'pointer',
                  minWidth: 'auto',
                  minHeight: '64px',
                  boxShadow: `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`,
                  outline: 'none',
                  textShadow: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '1.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 50px rgba(168, 85, 247, 0.9), 0 0 100px rgba(168, 85, 247, 0.7), 0 0 150px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px rgba(168, 85, 247, 0.7), 0 0 60px rgba(168, 85, 247, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = colors.accent;
                }}
              >
                <span style={{ position: 'relative', zIndex: 2, fontWeight: 700 }}>
                  BUY NOW
                </span>
              </button>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {PERSONAL_PLAN.features.map((feature, idx) => (
                  <li
                    key={idx}
                    style={{
                      color: colors.text,
                      opacity: 0.8,
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-inter), sans-serif',
                      marginBottom: '0.75rem',
                      paddingLeft: '1rem',
                      position: 'relative',
                      lineHeight: '1.5',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: colors.accent,
                        opacity: 0.8,
                        fontSize: '1rem',
                        top: '0.125rem',
                      }}
                    >
                      •
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Business Plans */}
          <div>
            <h3
              style={{
                color: colors.text,
                fontSize: '1.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-inter), sans-serif',
                marginBottom: '1.25rem',
              }}
            >
              Business Plans
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {BUSINESS_PACKAGES.map((pkg) => {
                const isHighlighted = highlightedPlan === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    id={`plan-${pkg.id}`}
                    className="flex flex-col"
                    style={{
                      borderRadius: '16px',
                      border: isHighlighted ? `3px solid ${colors.accent}` : `2px solid ${colors.accent}40`,
                      backgroundColor: isHighlighted ? `${colors.accent}20` : `${colors.accent}10`,
                      padding: '2rem',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      boxShadow: isHighlighted ? `0 0 40px ${colors.accent}50, 0 8px 32px ${colors.accent}40` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${colors.accent}40`;
                      e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <h4
                          style={{
                            color: colors.text,
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-inter), sans-serif',
                            marginBottom: '0.5rem',
                            lineHeight: '1.2',
                          }}
                        >
                          {pkg.name}
                        </h4>
                        <p
                          style={{
                            color: colors.text,
                            opacity: 0.8,
                            fontSize: '0.9375rem',
                            fontFamily: 'var(--font-inter), sans-serif',
                            lineHeight: '1.5',
                          }}
                        >
                          {pkg.description}
                        </p>
                      </div>
                      <div
                        style={{
                          color: colors.accent,
                          fontSize: '2rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-inter), sans-serif',
                          lineHeight: '1.2',
                          textAlign: 'right',
                        }}
                      >
                        ${pkg.maxPrice.toFixed(2)}
                        <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.8, marginLeft: '0.25rem' }}>/mo</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${colors.accent}30` }}>
                      <div>
                        <p
                          style={{
                            color: colors.text,
                            opacity: 0.75,
                            fontSize: '0.875rem',
                            fontFamily: 'var(--font-inter), sans-serif',
                            marginBottom: '0.5rem',
                          }}
                        >
                          Up to {formatMinutes(pkg.maxMinutes)}/month
                        </p>
                        <p
                          style={{
                            color: colors.accent,
                            opacity: 0.9,
                            fontSize: '0.875rem',
                            fontFamily: 'var(--font-inter), sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          Overage rate: ${pkg.overageRate.toFixed(2)}/minute
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            color: colors.text,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-inter), sans-serif',
                            marginBottom: '0.75rem',
                            opacity: 0.9,
                          }}
                        >
                          Ideal for:
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {pkg.idealFor.map((item, idx) => (
                            <li
                              key={idx}
                              style={{
                                color: colors.text,
                                opacity: 0.85,
                                fontSize: '0.875rem',
                                fontFamily: 'var(--font-inter), sans-serif',
                                marginBottom: '0.5rem',
                                paddingLeft: '1rem',
                                position: 'relative',
                                lineHeight: '1.5',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  color: colors.accent,
                                  opacity: 0.8,
                                  fontSize: '1rem',
                                  top: '0.125rem',
                                }}
                              >
                                •
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Enterprise Plan */}
              <Link
                id="plan-enterprise"
                href="/talk"
                className="w-full"
                style={{
                  borderRadius: '16px',
                  border: highlightedPlan === 'enterprise' ? `3px solid ${colors.accent}` : `2px solid ${colors.accent}40`,
                  backgroundColor: highlightedPlan === 'enterprise' ? `${colors.accent}20` : `${colors.accent}10`,
                  padding: '2rem',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  boxShadow: highlightedPlan === 'enterprise' ? `0 0 40px ${colors.accent}50, 0 8px 32px ${colors.accent}40` : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${colors.accent}40`;
                  e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h4
                      style={{
                        color: colors.text,
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-inter), sans-serif',
                        marginBottom: '0.5rem',
                        lineHeight: '1.2',
                      }}
                    >
                      {ENTERPRISE_PLAN.name}
                    </h4>
                    <p
                      style={{
                        color: colors.text,
                        opacity: 0.75,
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-inter), sans-serif',
                        lineHeight: '1.4',
                      }}
                    >
                      {ENTERPRISE_PLAN.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p
                      style={{
                        color: colors.accent,
                        fontSize: '1rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      Custom setup meeting required
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full" style={{ marginTop: '2rem', paddingLeft: 'clamp(2rem, 8vw, 10rem)', paddingRight: 'clamp(2rem, 8vw, 10rem)' }}>
        <h4
          style={{
            color: colors.text,
            fontSize: '1.125rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '2rem',
            textAlign: 'center',
          }}
        >
          Add-Ons
        </h4>
        <div className="space-y-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {addOnsByBusinessType.map((group, groupIndex) => {
            const isExpanded = expandedAddOnSections.has(group.businessTypeName);
            return (
              <div key={groupIndex} style={{ border: `1px solid ${colors.accent}30`, borderRadius: '12px', overflow: 'hidden' }}>
                <button
                  onClick={() => toggleAddOnSection(group.businessTypeName)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    backgroundColor: isExpanded ? `${colors.accent}15` : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isExpanded ? `${colors.accent}15` : 'transparent';
                  }}
                >
                  <h5
                    style={{
                      color: colors.accent,
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-inter), sans-serif',
                      margin: 0,
                    }}
                  >
                    {group.businessTypeName}
                  </h5>
                  {isExpanded ? (
                    <ChevronUp size={20} color={colors.accent} style={{ opacity: 0.8 }} />
                  ) : (
                    <ChevronDown size={20} color={colors.accent} style={{ opacity: 0.8 }} />
                  )}
                </button>
                <div
                  style={{
                    maxHeight: isExpanded ? '2000px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.4s ease-in-out, padding 0.4s ease-in-out',
                    padding: isExpanded ? '1.5rem' : '0 1.5rem',
                  }}
                >
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    style={{
                      gap: '1rem',
                    }}
                  >
                    {group.addOns.map((addOn) => (
                      <div
                        key={addOn.id}
                        style={{
                          padding: '1.25rem',
                          borderRadius: '12px',
                          border: `1px solid ${colors.accent}40`,
                          backgroundColor: `${colors.accent}10`,
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.accent;
                          e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent}30`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `${colors.accent}40`;
                          e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span
                          style={{
                            color: colors.text,
                            opacity: 0.9,
                            fontFamily: 'var(--font-inter), sans-serif',
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                          }}
                        >
                          {addOn.title}
                        </span>
                        <span
                          style={{
                            color: colors.accent,
                            fontFamily: 'var(--font-inter), sans-serif',
                            fontSize: '1rem',
                            fontWeight: 600,
                          }}
                        >
                          +${addOn.price.toFixed(2)}/mo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full" style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p
          style={{
            color: colors.text,
            opacity: 0.8,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '1rem',
          }}
        >
          Extra phone lines: ${PHONE_LINE_PRICE}/mo each
        </p>
        <p
          style={{
            color: colors.text,
            opacity: 0.7,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '0.5rem',
          }}
        >
          All plans include standard features. No credit card required for free trial.
        </p>
        <p
          style={{
            color: colors.accent,
            opacity: 0.8,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 500,
          }}
        >
          Pricing is based on total minutes per month. Use our configurator to see your recommended plan.
        </p>
      </div>
    </div>
  );
}
