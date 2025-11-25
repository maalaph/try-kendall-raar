'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import BusinessTypeStep from './BusinessTypeStep';
import StandardFeaturesStep from './StandardFeaturesStep';
import AlsoIncludesStep from './AlsoIncludesStep';
import AddOnsStep from './AddOnsStep';
import CallVolumeStep from './CallVolumeStep';
import CallDurationStep from './CallDurationStep';
import PricingSummary from './PricingSummary';
import TrialFormDrawer from './TrialFormDrawer';
import KendallPowerUps from './KendallPowerUps';
import KendallExpansion from './KendallExpansion';
import { colors } from '@/lib/config';
import { getBusinessTypeData } from '@/lib/businessTypes';

export default function ConfiguratorWizard() {
  const pathname = usePathname();
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [callVolume, setCallVolume] = useState<string | null>('0');
  const [callDuration, setCallDuration] = useState<string | null>('0');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const hasRestoredState = useRef(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [shouldAnimateContent, setShouldAnimateContent] = useState(false);
  const [headerHasAnimated, setHeaderHasAnimated] = useState(false);
  const [hoveredAddOnId, setHoveredAddOnId] = useState<string | null>(null);
  const [justToggledAddOnId, setJustToggledAddOnId] = useState<string | null>(null);
  const addOnsRef = useRef<HTMLDivElement>(null);
  const priceBreakdownRef = useRef<HTMLDivElement>(null);
  const businessTypesRef = useRef<HTMLDivElement>(null);
  const [powerUpsPosition, setPowerUpsPosition] = useState({ top: 0, left: 0 });
  const [showPowerUps, setShowPowerUps] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionStartPos, setExpansionStartPos] = useState({ x: 0, y: 0 });
  const bookingSectionRef = useRef<HTMLDivElement>(null);

  // Trigger animation when booking section comes into view
  useEffect(() => {
    if (shouldAnimate) return; // Already animated

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !shouldAnimate) {
            setShouldAnimate(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (bookingSectionRef.current) {
      observer.observe(bookingSectionRef.current);
    }

    return () => {
      if (bookingSectionRef.current) {
        observer.unobserve(bookingSectionRef.current);
      }
    };
  }, [shouldAnimate]);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (businessType || selectedAddOns.length > 0 || callVolume !== '0' || callDuration !== '0')) {
      sessionStorage.setItem('wizardState', JSON.stringify({
        businessType,
        callVolume,
        callDuration,
        selectedAddOns,
      }));
    }
  }, [businessType, callVolume, callDuration, selectedAddOns]);

  // Check for returning from pricing page - runs on mount and pathname change
  useEffect(() => {
    // If we're on the pricing page, reset the restoration flag so we can restore when coming back
    if (pathname === '/pricing') {
      hasRestoredState.current = false;
      return;
    }
    
    // If already restored in this session, don't restore again (unless we just came from pricing)
    if (hasRestoredState.current) {
      // Check if returningFromPricing flag is set - if so, we should restore again
      const returningFromPricing = typeof window !== 'undefined' && sessionStorage.getItem('returningFromPricing') === 'true';
      if (!returningFromPricing) {
        return;
      }
      // Reset the flag so we can restore
      hasRestoredState.current = false;
    }
    
    const returningFromPricing = typeof window !== 'undefined' && sessionStorage.getItem('returningFromPricing') === 'true';
    const savedState = typeof window !== 'undefined' ? sessionStorage.getItem('wizardState') : null;
    
    if (returningFromPricing && savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.businessType) {
          setBusinessType(state.businessType);
          setCallVolume(state.callVolume || '0');
          setCallDuration(state.callDuration || '0');
          setSelectedAddOns(state.selectedAddOns || []);
          // phoneLines will be restored in PricingSummary
          hasRestoredState.current = true;
          // Clear the flag
          sessionStorage.removeItem('returningFromPricing');
          // Trigger animation since we're restoring state
          setShouldAnimate(true);
          setHeaderHasAnimated(true);
          setShouldAnimateContent(true);
        }
      } catch (e) {
        console.error('Failed to restore wizard state:', e);
      }
    }
  }, [pathname]); // Re-check when pathname changes (e.g., when navigating back)

  // Trigger initial domino effect only when triggered by "Feel Kendall in Action" button
  useEffect(() => {
    // Check if we've already restored state
    const returningFromPricing = typeof window !== 'undefined' && sessionStorage.getItem('returningFromPricing') === 'true';
    
    if (!returningFromPricing && !hasRestoredState.current) {
      // On page load/refresh (not returning from pricing), always reset to hero section
      // Remove hash from URL and reset all state
      if (typeof window !== 'undefined') {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      setBusinessType(null);
      setShouldAnimateContent(false);
      setHeaderHasAnimated(false);
      setSelectedAddOns([]);
      setCallVolume('0');
      setCallDuration('0');
      setHoveredAddOnId(null);
      setJustToggledAddOnId(null);
      setIsDrawerOpen(false);
      setIsSubmitted(false);
      setIsExpanding(false);
      setShowPowerUps(false);

      // Don't auto-start on any route - wait for custom event trigger
      setShouldAnimate(false);
    }

    const handleAnimationTrigger = () => {
      setShouldAnimate(true);
    };

    const handleOpenTrialForm = () => {
      // Open trial form directly, bypassing configurator
      setIsDrawerOpen(true);
    };

    // Listen for custom events
    window.addEventListener('triggerConfiguratorAnimation', handleAnimationTrigger);
    window.addEventListener('openTrialForm', handleOpenTrialForm);

    return () => {
      window.removeEventListener('triggerConfiguratorAnimation', handleAnimationTrigger);
      window.removeEventListener('openTrialForm', handleOpenTrialForm);
    };
  }, []); // Run only once on mount

  // Listen for popstate (browser back/forward) and visibility changes to restore state
  useEffect(() => {
    const checkAndRestoreState = () => {
      if (hasRestoredState.current) return;
      
      const returningFromPricing = typeof window !== 'undefined' && sessionStorage.getItem('returningFromPricing') === 'true';
      const savedState = typeof window !== 'undefined' ? sessionStorage.getItem('wizardState') : null;
      
      if (returningFromPricing && savedState) {
        try {
          const state = JSON.parse(savedState);
          if (state.businessType) {
            setBusinessType(state.businessType);
            setCallVolume(state.callVolume || '0');
            setCallDuration(state.callDuration || '0');
            setSelectedAddOns(state.selectedAddOns || []);
            hasRestoredState.current = true;
            sessionStorage.removeItem('returningFromPricing');
            setShouldAnimate(true);
            setHeaderHasAnimated(true);
            setShouldAnimateContent(true);
          }
        } catch (e) {
          console.error('Failed to restore wizard state:', e);
        }
      }
    };

    const handlePopState = () => {
      // Small delay to ensure sessionStorage is accessible after navigation
      setTimeout(checkAndRestoreState, 150);
    };

    const handleVisibilityChange = () => {
      // When page becomes visible again (e.g., after navigating back from another tab/window)
      if (!document.hidden) {
        setTimeout(checkAndRestoreState, 100);
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also check immediately in case we missed the popstate event
    setTimeout(checkAndRestoreState, 200);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Reset add-ons when business type changes (since different types have different add-ons)
  const previousBusinessType = useRef<string | null>(null);
  useEffect(() => {
    if (businessType && previousBusinessType.current && previousBusinessType.current !== businessType) {
      // Business type changed - reset add-ons
      setSelectedAddOns([]);
    }
    previousBusinessType.current = businessType;
  }, [businessType]);

  // Trigger content animation when business type is selected (only on first selection)
  useEffect(() => {
    if (businessType && shouldAnimate && !headerHasAnimated) {
      // Mark header as animated on first business type selection
      setHeaderHasAnimated(true);
      // Reset animation state first to trigger disappear effect
      setShouldAnimateContent(false);
      // Small delay to let the business types transition to horizontal layout, then trigger reappear
      const timer = setTimeout(() => {
        setShouldAnimateContent(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (businessType && shouldAnimate && headerHasAnimated) {
      // If changing business type after first selection, just show content without re-animating header
      setShouldAnimateContent(true);
    } else if (!businessType) {
      setShouldAnimateContent(false);
    }
  }, [businessType, shouldAnimate, headerHasAnimated]);

  const handleToggleAddOn = (addOnId: string) => {
    const wasSelected = selectedAddOns.includes(addOnId);
    setSelectedAddOns((prev) =>
      prev.includes(addOnId)
        ? prev.filter((id) => id !== addOnId)
        : [...prev, addOnId]
    );
    // Trigger activation animation if adding (not removing)
    if (!wasSelected) {
      setJustToggledAddOnId(addOnId);
      setTimeout(() => setJustToggledAddOnId(null), 1000);
    }
  };

  const handleFormSubmit = (data: {
    fullName: string;
    businessName: string;
    phone: string;
    email: string;
    website?: string;
    bookingSystem?: string;
  }) => {
    // Here you would typically send the data to your API
    console.log('Form submitted:', data);
    
    setIsDrawerOpen(false);
    setIsSubmitted(true);
  };

  // Show confirmation message after submission
  if (isSubmitted) {
    return (
      <div
        className="w-full min-h-screen flex items-center justify-center"
        style={{ padding: 'clamp(2rem, 6vw, 8rem) clamp(2rem, 8vw, 10rem)' }}
      >
        <div
          className="p-8 rounded-xl text-center"
          style={{
            border: `2px solid ${colors.accent}40`,
            backgroundColor: `${colors.accent}10`,
            maxWidth: '600px',
          }}
        >
          <h2
            style={{
              color: colors.text,
              fontSize: '1.5rem',
              fontWeight: 500,
              fontFamily: 'var(--font-inter), sans-serif',
              marginBottom: '1rem',
            }}
          >
            Your free trial is being activated.
          </h2>
          <p
            style={{
              color: colors.text,
              opacity: 0.9,
              fontSize: '1rem',
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            Check your email for next steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={bookingSectionRef}
        className="w-full min-h-screen"
        style={{ padding: 'clamp(2rem, 4vw, 4rem) clamp(2rem, 8vw, 10rem)' }}
      >
        <div className="w-full mx-auto" style={{ maxWidth: '1400px', width: '100%' }}>
          {/* Mobile: Single column */}
          <Fragment>
            <div className="block lg:hidden" style={{ paddingBottom: businessType ? '200px' : '0' }}>
              {/* Header - Left aligned, above business types */}
              <div 
                className="w-full mb-8" 
                style={{ 
                  marginBottom: 'clamp(2rem, 4vw, 3rem)',
                  minHeight: '80px', // Reserve space to prevent shift
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '1rem',
                    opacity: shouldAnimate ? 1 : 1,
                    transform: shouldAnimate 
                      ? 'translateX(0) translateY(0)' 
                      : 'translateX(0) translateY(0)',
                    transition: headerHasAnimated ? 'none' : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <h2
                    style={{ 
                      color: colors.text, 
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                      fontWeight: 300,
                      letterSpacing: '-0.02em',
                      lineHeight: '1.2',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Build Your{' '}
                    <span 
                      className="kendall-glow"
                      style={{
                        color: colors.accent,
                        opacity: 0.75,
                        fontFamily: 'var(--font-league-spartan), sans-serif',
                        fontWeight: 700,
                        display: 'inline-block',
                      }}
                    >
                      Kendall
                    </span>.
                  </h2>
                  {/* Kendall Power-ups Sphere - Always visible with header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      minWidth: '80px',
                      minHeight: '80px',
                      pointerEvents: 'none',
                      opacity: shouldAnimate ? 1 : 1,
                      transition: headerHasAnimated ? 'none' : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    <KendallPowerUps
                      selectedAddOns={selectedAddOns}
                      hoveredAddOnId={hoveredAddOnId}
                      justToggledAddOnId={justToggledAddOnId}
                      businessType={businessType}
                      shouldAnimate={shouldAnimate}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3rem, 4vw, 4rem)' }}>
                {/* Business Type Selector */}
                <BusinessTypeStep
                  selectedType={businessType}
                  onSelect={setBusinessType}
                  shouldAnimate={shouldAnimate}
                />

                {/* Two Sliders */}
                {businessType && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3rem, 4vw, 4.5rem)' }}>
                    <CallVolumeStep
                      key={`volume-mobile-${businessType}`}
                      selectedVolume={callVolume}
                      onSelect={setCallVolume}
                      businessType={businessType}
                      shouldAnimate={shouldAnimateContent}
                    />
                    <CallDurationStep
                      key={`duration-mobile-${businessType}`}
                      selectedDuration={callDuration}
                      onSelect={setCallDuration}
                      shouldAnimate={shouldAnimateContent}
                    />
                  </div>
                )}

                {/* Standard Features */}
                {businessType && (
                  <StandardFeaturesStep businessType={businessType} shouldAnimate={shouldAnimateContent} />
                )}

                {/* Also Includes */}
                {businessType && (
                  <AlsoIncludesStep businessType={businessType} shouldAnimate={shouldAnimateContent} />
                )}

                {/* Add-Ons */}
                {businessType && (
                  <div style={{ marginTop: 'clamp(2rem, 3vw, 3rem)' }}>
                    <AddOnsStep
                      businessType={businessType}
                      selectedAddOns={selectedAddOns}
                      onToggleAddOn={handleToggleAddOn}
                      shouldAnimate={shouldAnimateContent}
                      onAddOnHover={setHoveredAddOnId}
                      justToggledAddOnId={justToggledAddOnId}
                    />
                  </div>
                )}
                </div>
              </div>

              {/* Pricing Summary - Sticky bottom bar on mobile ONLY */}
              {businessType && (
                <div
                  className="lg:hidden"
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: colors.primary,
                    padding: '1rem',
                    zIndex: 100,
                    borderTop: `2px solid ${colors.accent}40`,
                    boxShadow: `0 -4px 20px rgba(0, 0, 0, 0.3)`,
                    maxHeight: '50vh',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <PricingSummary
                      businessType={businessType}
                      callVolume={callVolume}
                      callDuration={callDuration}
                      selectedAddOns={selectedAddOns}
                      onStartTrial={() => setIsDrawerOpen(true)}
                    />
                  </div>
                </div>
              )}
            </Fragment>

          {/* Desktop: Two-column layout */}
          <div className="hidden lg:block">
              {/* Two-column layout - Centered beneath header */}
              <div className="grid grid-cols-12 items-start relative" style={{ gap: 'clamp(2rem, 4vw, 3rem)', marginTop: 'clamp(2rem, 4vw, 3rem)' }}>
                {/* Left: Business Types, Standard Features, Also Includes, Add-Ons */}
                <div className="col-span-7" style={{ maxWidth: '700px' }}>
                  {/* Header positioned above business types */}
                  <div className="mb-8" style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 'clamp(2rem, 4vw, 3rem)',
                        opacity: shouldAnimate ? 1 : 1,
                        transition: headerHasAnimated ? 'none' : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      <h2
                        style={{ 
                          color: colors.text, 
                          fontFamily: 'var(--font-inter), sans-serif',
                          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                          fontWeight: 300,
                          letterSpacing: '-0.02em',
                          lineHeight: '1.2',
                          margin: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Build Your{' '}
                        <span 
                          className="kendall-glow"
                          style={{
                            color: colors.accent,
                            opacity: 0.75,
                            fontFamily: 'var(--font-league-spartan), sans-serif',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}
                        >
                          Kendall
                        </span>.
                      </h2>
                      {/* Kendall Power-ups Sphere */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minWidth: '120px',
                          minHeight: '120px',
                          pointerEvents: 'none',
                          opacity: shouldAnimate ? 1 : 1,
                          transition: headerHasAnimated ? 'none' : 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      >
                        <KendallPowerUps
                          selectedAddOns={selectedAddOns}
                          hoveredAddOnId={hoveredAddOnId}
                          justToggledAddOnId={justToggledAddOnId}
                          businessType={businessType}
                          shouldAnimate={shouldAnimate}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}>
                    {/* Business Type Selector - Fixed position container */}
                    <div 
                      ref={businessTypesRef}
                      style={{ 
                        position: 'relative',
                        minHeight: businessType ? '60px' : '200px', // Reserve space to prevent shift
                        transition: 'min-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        width: '100%',
                      }}
                    >
                      <BusinessTypeStep
                        selectedType={businessType}
                        onSelect={setBusinessType}
                        shouldAnimate={shouldAnimate}
                      />
                    </div>

                    {/* Standard Features */}
                    {businessType && (
                      <StandardFeaturesStep businessType={businessType} shouldAnimate={shouldAnimateContent} />
                    )}

                    {/* Also Includes */}
                    {businessType && (
                      <AlsoIncludesStep businessType={businessType} shouldAnimate={shouldAnimateContent} />
                    )}

                    {/* Add-Ons */}
                    {businessType && (
                      <div 
                        ref={addOnsRef}
                        style={{ 
                          marginTop: 'clamp(2rem, 3vw, 3rem)',
                        }}
                      >
                        <AddOnsStep
                          businessType={businessType}
                          selectedAddOns={selectedAddOns}
                          onToggleAddOn={handleToggleAddOn}
                          shouldAnimate={shouldAnimateContent}
                          onAddOnHover={setHoveredAddOnId}
                          justToggledAddOnId={justToggledAddOnId}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Sliders and Price - Aligned with Standard Features */}
                <div className="col-span-5">
                  <div
                    style={{
                      position: 'sticky',
                      top: 'clamp(2rem, 6vw, 8rem)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'clamp(1.5rem, 2.5vw, 2.5rem)',
                      height: 'fit-content',
                    }}
                  >
                    {/* Spacer to align sliders with Standard Features */}
                    {/* Account for: Header + Business Types + gap to Standard Features */}
                    {businessType && (
                      <div style={{ 
                        height: 'calc(clamp(2rem, 4vw, 3rem) + 60px + clamp(1.5rem, 2.5vw, 2.5rem))',
                        minHeight: 'calc(clamp(2rem, 4vw, 3rem) + 60px + clamp(1.5rem, 2.5vw, 2.5rem))',
                      }} />
                    )}

                    {/* Two Sliders - Aligned with Standard Features and Also Includes */}
                    {businessType && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3rem, 4vw, 4.5rem)' }}>
                        <CallVolumeStep
                          key={`volume-${businessType}`}
                          selectedVolume={callVolume}
                          onSelect={setCallVolume}
                          businessType={businessType}
                          shouldAnimate={shouldAnimateContent}
                        />
                        <CallDurationStep
                          key={`duration-${businessType}`}
                          selectedDuration={callDuration}
                          onSelect={setCallDuration}
                          shouldAnimate={shouldAnimateContent}
                        />
                      </div>
                    )}

                    {/* Price Breakdown - Aligned with Add-Ons */}
                    {/* Position to align with Add-Ons section with spacing from sliders */}
                    {businessType && (
                      <div 
                        ref={priceBreakdownRef}
                        style={{ 
                          marginTop: 'clamp(3rem, 5vw, 4rem)',
                        }}
                      >
                        <PricingSummary
                          businessType={businessType}
                          callVolume={callVolume}
                          callDuration={callDuration}
                          selectedAddOns={selectedAddOns}
                          onStartTrial={() => {
                            // Get the add-ons position on screen for expansion start
                            if (addOnsRef.current && priceBreakdownRef.current) {
                              const addOnsRect = addOnsRef.current?.getBoundingClientRect();
                              const priceRect = priceBreakdownRef.current?.getBoundingClientRect();
                              
                              if (addOnsRect && priceRect) {
                                const x = priceRect.left + priceRect.width / 2;
                                const y = addOnsRect.top + addOnsRect.height / 2;
                                setExpansionStartPos({ x, y });
                                setIsExpanding(true);
                              } else {
                                // Fallback: center of screen
                                setExpansionStartPos({ 
                                  x: window.innerWidth / 2, 
                                  y: window.innerHeight / 2 
                                });
                                setIsExpanding(true);
                              }
                            } else {
                              // Fallback: center of screen
                              setExpansionStartPos({ 
                                x: window.innerWidth / 2, 
                                y: window.innerHeight / 2 
                              });
                              setIsExpanding(true);
                            }
                          }}
                          shouldAnimate={shouldAnimateContent}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Kendall Expansion Animation */}
      <KendallExpansion
        isActive={isExpanding}
        startPosition={expansionStartPos}
        onComplete={() => {
          setIsExpanding(false);
          setIsDrawerOpen(true);
        }}
      />

      {/* Trial Form Drawer */}
      <TrialFormDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </>
  );
}
