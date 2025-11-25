'use client';

import { useState, useEffect, useRef } from 'react';
import { colors } from '@/lib/config';

interface AddOn {
  id: string;
  title: string;
  description: string;
  price: number; // Monthly price
}

interface PricingSummaryStepProps {
  businessType: string | null;
  callVolume: string | null;
  selectedAddOns: string[];
  onToggleAddOn: (id: string) => void;
  onSelectVolume: (volume: string) => void;
  onBack: () => void;
}

const standardFeatures = [
  '24/7 Call Answering',
  'Instant Missed-Call Text Back',
  'Basic Service Questions',
  'Client Intake',
  'Booking Inside Your Existing System',
  'Calendar Integration',
];

const addOns: AddOn[] = [
  {
    id: 'reminder-confirmation',
    title: 'Reminder & Confirmation Setup (No-Show Killer)',
    description: 'Automatically reduce no-shows with smart reminders and confirmations.',
    price: 49, // Example price - adjust as needed
  },
  {
    id: 'client-preference',
    title: 'Client Preference Memory',
    description: 'Kendall remembers your clients preferences for a personalized experience.',
    price: 39,
  },
  {
    id: 'post-appointment',
    title: 'Post-Appointment Engagement',
    description: 'Keep clients engaged and coming back with automated follow-ups.',
    price: 59,
  },
  {
    id: 'waitlist-autofill',
    title: 'Waitlist Auto-Fill',
    description: 'Automatically fill cancellations and newly opened slots from your waitlist.',
    price: 29,
  },
];

// Calculate base price based on call volume
const calculateBasePrice = (callVolume: string | null): number => {
  if (!callVolume) return 0;
  const num = parseInt(callVolume);
  if (isNaN(num)) return 0;
  
  // Example pricing tiers - adjust as needed
  if (num <= 10) return 99;
  if (num <= 20) return 149;
  if (num <= 40) return 199;
  if (num <= 60) return 249;
  return 299; // 60+
};

const volumeLabels = ['0', '20', '40', '60+'];

export default function PricingSummaryStep({
  businessType,
  callVolume,
  selectedAddOns,
  onToggleAddOn,
  onSelectVolume,
  onBack,
}: PricingSummaryStepProps) {
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  
  // Slider state
  const getNumericValue = (volume: string | null): number => {
    if (!volume) return 0;
    const directNumber = parseInt(volume);
    if (!isNaN(directNumber)) {
      return directNumber;
    }
    const match = volume.match(/(\d+)-(\d+)/);
    if (match) {
      return (parseInt(match[1]) + parseInt(match[2])) / 2;
    }
    return 0;
  };

  const initialValue = getNumericValue(callVolume);
  const [localValue, setLocalValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);
  const localValueRef = useRef(initialValue);
  const animationFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxValue = 60;

  useEffect(() => {
    // Staggered fade-in for standard features
    const timers = standardFeatures.map((_, index) => {
      return setTimeout(() => {
        setVisibleItems((prev) => [...prev, index]);
      }, index * 75);
    });
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Slider functions - defined first
  const updateSliderVisual = (value: number) => {
    if (!thumbRef.current || !trackFillRef.current) return;
    let percentage: number;
    if (value >= 60) {
      percentage = 100;
    } else {
      percentage = (value / 60) * 100;
    }
    thumbRef.current.style.left = `${percentage}%`;
    trackFillRef.current.style.width = `${percentage}%`;
  };

  // Slider logic
  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    if (callVolume && !isDragging && !isTyping) {
      const directNumber = parseInt(callVolume);
      if (!isNaN(directNumber)) {
        setLocalValue(directNumber);
        localValueRef.current = directNumber;
        const sliderValue = directNumber > 60 ? 100 : directNumber;
        updateSliderVisual(sliderValue);
      } else {
        const newValue = getNumericValue(callVolume);
        setLocalValue(newValue);
        localValueRef.current = newValue;
        const sliderValue = newValue > 60 ? 100 : newValue;
        updateSliderVisual(sliderValue);
      }
    }
  }, [callVolume, isDragging, isTyping]);

  const getValueFromPosition = (clientX: number): number => {
    if (!sliderRef.current) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = x / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    const mappedValue = percentage * 60;
    return Math.min(60, mappedValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const newValue = getValueFromPosition(e.clientX);
    const cappedValue = Math.max(0, Math.min(60, Math.round(newValue)));
    localValueRef.current = cappedValue;
    updateSliderVisual(cappedValue);
    setLocalValue(cappedValue);
    onSelectVolume(String(cappedValue));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = getValueFromPosition(touch.clientX);
    const cappedValue = Math.min(60, Math.round(newValue));
    setLocalValue(cappedValue);
    localValueRef.current = cappedValue;
    updateSliderVisual(cappedValue);
    onSelectVolume(String(cappedValue));
  };

  const handleClick = (targetValue: number) => {
    const cappedValue = Math.max(0, Math.min(60, targetValue));
    setLocalValue(cappedValue);
    localValueRef.current = cappedValue;
    updateSliderVisual(cappedValue);
    onSelectVolume(String(cappedValue));
  };

  useEffect(() => {
    if (!isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let lastUpdateTime = 0;
    const throttleMs = 16;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      lastUpdateTime = now;

      const newValue = getValueFromPosition(e.clientX);
      const cappedValue = Math.max(0, Math.min(60, Math.round(newValue)));

      if (cappedValue !== localValueRef.current) {
        localValueRef.current = cappedValue;
        updateSliderVisual(cappedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(cappedValue);
          onSelectVolume(String(cappedValue));
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastUpdateTime < throttleMs) return;
      lastUpdateTime = now;

      const touch = e.touches[0];
      const newValue = getValueFromPosition(touch.clientX);
      const cappedValue = Math.max(0, Math.min(60, Math.round(newValue)));

      if (cappedValue !== localValueRef.current) {
        localValueRef.current = cappedValue;
        updateSliderVisual(cappedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(cappedValue);
          onSelectVolume(String(cappedValue));
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDragging, onSelectVolume]);

  // Initialize slider visual on mount
  useEffect(() => {
    if (thumbRef.current && trackFillRef.current) {
      const initialVal = getNumericValue(callVolume);
      const sliderValue = initialVal > 60 ? 100 : initialVal;
      updateSliderVisual(sliderValue);
      setLocalValue(initialVal);
      localValueRef.current = initialVal;
    }
  }, []);

  const formatCallVolume = (volume: string | null): string => {
    if (!volume) return 'Not selected';
    const num = parseInt(volume);
    if (!isNaN(num) && volume === String(num)) {
      return `${num} calls/day`;
    }
    return volume;
  };

  const basePrice = calculateBasePrice(callVolume);
  const addOnTotal = addOns
    .filter((addOn) => selectedAddOns.includes(addOn.id))
    .reduce((sum, addOn) => sum + addOn.price, 0);
  const totalPrice = basePrice + addOnTotal;

  const handleCheckboxClick = (addOnId: string) => {
    onToggleAddOn(addOnId);
    setJustChecked(addOnId);
    setTimeout(() => setJustChecked(null), 600);
  };

  return (
    <div className="w-full" style={{ paddingBottom: '4rem' }}>
      <h2
        className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight"
        style={{ color: colors.text, marginBottom: '3rem' }}
      >
        Your Configuration Summary
      </h2>

      {/* Standard Features Section */}
      <div className="space-y-4" style={{ marginBottom: '4rem' }}>
        <h3
          style={{
            color: colors.text,
            fontSize: '1.25rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '1rem',
          }}
        >
          Standard Features
        </h3>
        <div
          className="p-6 rounded-xl"
          style={{
            border: `2px solid ${colors.accent}40`,
            backgroundColor: `${colors.accent}10`,
          }}
        >
          <ul className="space-y-3" style={{ listStyle: 'none', padding: 0 }}>
            {standardFeatures.map((feature, index) => {
              const isVisible = visibleItems.includes(index);
              return (
                <li
                  key={index}
                  className="flex items-start gap-3"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(-5px)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
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
                    {feature}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Add-Ons Section */}
      <div className="space-y-4" style={{ marginBottom: '4rem' }}>
        <h3
          style={{
            color: colors.text,
            fontSize: '1.25rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '1rem',
          }}
        >
          Add-Ons
        </h3>
        <div className="space-y-3">
          {addOns.map((addOn) => {
            const isSelected = selectedAddOns.includes(addOn.id);
            const isJustChecked = justChecked === addOn.id && isSelected;

            return (
              <div
                key={addOn.id}
                style={{
                  border: `2px solid ${isSelected ? colors.accent : `${colors.accent}40`}`,
                  borderRadius: '12px',
                  padding: '1.25rem',
                  backgroundColor: isSelected ? `${colors.accent}15` : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: isSelected
                    ? `0 0 25px ${colors.accent}30, 0 4px 20px ${colors.accent}20`
                    : `0 2px 8px ${colors.accent}10`,
                }}
                onClick={() => handleCheckboxClick(addOn.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = `${colors.accent}60`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = `${colors.accent}40`;
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div
                    style={{
                      position: 'relative',
                      width: '24px',
                      height: '24px',
                      minWidth: '24px',
                      marginTop: '0.125rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCheckboxClick(addOn.id)}
                      style={{
                        position: 'absolute',
                        width: '24px',
                        height: '24px',
                        margin: 0,
                        cursor: 'pointer',
                        opacity: 0,
                        zIndex: 2,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: '24px',
                        height: '24px',
                        border: `2px solid ${isSelected ? colors.accent : `${colors.accent}60`}`,
                        borderRadius: '4px',
                        backgroundColor: isSelected ? colors.accent : 'transparent',
                        transition: 'all 0.3s ease',
                        boxShadow: isJustChecked
                          ? `0 0 20px ${colors.accent}, 0 0 40px ${colors.accent}80, inset 0 0 20px ${colors.accent}`
                          : isSelected
                          ? `0 0 10px ${colors.accent}50, inset 0 0 10px ${colors.accent}30`
                          : 'none',
                        animation: isJustChecked ? 'checkbox-glow 0.6s ease-out' : 'none',
                      }}
                    >
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: colors.primary,
                          }}
                        >
                          <path
                            d="M13.5 4L6 11.5L2.5 8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {/* Purple glow from inside when checked */}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: `radial-gradient(circle, ${colors.accent}60 0%, transparent 70%)`,
                            animation: isJustChecked
                              ? 'checkbox-pulse 0.6s ease-out'
                              : 'checkbox-glow-subtle 2s ease-in-out infinite',
                            pointerEvents: 'none',
                            zIndex: 1,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4
                        style={{
                          color: colors.text,
                          fontSize: '1rem',
                          fontWeight: 500,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        {addOn.title}
                      </h4>
                      {isSelected && (
                        <span
                          style={{
                            color: colors.accent,
                            fontSize: '1rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-inter), sans-serif',
                          }}
                        >
                          +${addOn.price}/mo
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        color: colors.text,
                        opacity: 0.8,
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      {addOn.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Call Volume Slider - After Add-Ons, Before Price Breakdown */}
      <div className="space-y-4" style={{ marginBottom: '4rem' }}>
        <h3
          style={{
            color: colors.text,
            fontSize: '1.25rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '2rem',
          }}
        >
          How many calls do you receive per day?
        </h3>
        <div className="flex items-center gap-6" style={{ padding: '2rem 0' }}>
          {/* Slider Container */}
          <div className="flex-1" style={{ minHeight: '60px' }}>
            <div
              ref={sliderRef}
              className="relative w-full cursor-pointer"
              style={{
                height: '8px',
                backgroundColor: `${colors.accent}20`,
                borderRadius: '4px',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div
                ref={trackFillRef}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  backgroundColor: colors.accent,
                  borderRadius: '4px',
                  transition: isDragging ? 'none' : 'width 0.2s ease',
                  width: '0%',
                }}
              />

              <div
                ref={thumbRef}
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  backgroundColor: colors.accent,
                  borderRadius: '50%',
                  cursor: 'grab',
                  boxShadow: `0 0 20px ${colors.accent}50`,
                  left: '0%',
                  zIndex: 10,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              />

              {volumeLabels.map((label, index) => {
                let position: number;
                let targetValue: number;

                if (index === 0) {
                  position = 0;
                  targetValue = 0;
                } else if (index === 1) {
                  position = 33.33;
                  targetValue = 20;
                } else if (index === 2) {
                  position = 66.66;
                  targetValue = 40;
                } else {
                  position = 100;
                  targetValue = 60;
                }

                return (
                  <div
                    key={label}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClick(targetValue);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      top: 'calc(50% + 35px)',
                      transform: 'translateX(-50%)',
                      cursor: 'pointer',
                      padding: '6px 10px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      fontFamily: 'var(--font-inter), sans-serif',
                      color: colors.text,
                      opacity: 0.7,
                      transition: 'all 0.25s ease',
                      pointerEvents: 'auto',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = colors.accent;
                      e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.color = colors.text;
                      e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Input Box on the Right */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={localValue > 60 ? '60' : (localValue === 0 ? '' : String(Math.round(localValue)))}
            placeholder="0"
            onChange={(e) => {
              const value = e.target.value;
              setIsTyping(true);

              if (value === '') {
                setLocalValue(0);
                localValueRef.current = 0;
                onSelectVolume('0');
                return;
              }

              if (/^\d*$/.test(value)) {
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue >= 0) {
                  setLocalValue(numValue);
                  localValueRef.current = numValue;
                  const sliderValue = numValue > 60 ? 100 : numValue;
                  if (thumbRef.current && trackFillRef.current) {
                    const percentage = sliderValue >= 60 ? 100 : (sliderValue / 60) * 100;
                    thumbRef.current.style.left = `${percentage}%`;
                    trackFillRef.current.style.width = `${percentage}%`;
                  }
                  onSelectVolume(String(numValue));
                }
              }
            }}
            onFocus={(e) => {
              setIsTyping(true);
              e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}50`;
              e.currentTarget.style.borderColor = colors.accent;
            }}
            onBlur={(e) => {
              setIsTyping(false);
              e.currentTarget.style.boxShadow = 'none';
              const value = e.target.value.trim();
              if (value === '') {
                setLocalValue(0);
                localValueRef.current = 0;
                onSelectVolume('0');
              } else {
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue >= 0) {
                  onSelectVolume(String(numValue));
                }
              }
            }}
            style={{
              backgroundColor: `${colors.accent}15`,
              border: `2px solid ${colors.accent}`,
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              width: '120px',
              textAlign: 'center',
              outline: 'none',
              transition: 'all 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Price Breakdown */}
      <div
        className="p-6 rounded-xl space-y-4"
        style={{
          border: `2px solid ${colors.accent}40`,
          backgroundColor: `${colors.accent}10`,
          marginBottom: '4rem',
        }}
      >
        <h3
          style={{
            color: colors.text,
            fontSize: '1.25rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            marginBottom: '1rem',
          }}
        >
          Price Breakdown
        </h3>

        <div className="space-y-3">
          {/* Base Price */}
          <div className="flex items-center justify-between">
            <span
              style={{
                color: colors.text,
                opacity: 0.9,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '0.95rem',
              }}
            >
              Base Plan ({formatCallVolume(callVolume)})
            </span>
            <span
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '0.95rem',
                fontWeight: 500,
              }}
            >
              ${basePrice}/mo
            </span>
          </div>

          {/* Add-On Prices */}
          {addOns
            .filter((addOn) => selectedAddOns.includes(addOn.id))
            .map((addOn) => (
              <div key={addOn.id} className="flex items-center justify-between">
                <span
                  style={{
                    color: colors.text,
                    opacity: 0.9,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '0.95rem',
                  }}
                >
                  {addOn.title}
                </span>
                <span
                  style={{
                    color: colors.accent,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  +${addOn.price}/mo
                </span>
              </div>
            ))}

          {/* Total */}
          <div
            className="flex items-center justify-between pt-3"
            style={{
              borderTop: `1px solid ${colors.accent}40`,
              marginTop: '0.5rem',
            }}
          >
            <span
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '1.125rem',
                fontWeight: 600,
              }}
            >
              Total Monthly Price
            </span>
            <span
              style={{
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              ${totalPrice}/mo
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex flex-col items-center gap-4" style={{ marginTop: '3rem' }}>
        <button
          className="group relative flex items-center justify-center overflow-hidden touch-manipulation w-full sm:w-auto"
          style={{
            color: colors.text,
            backgroundColor: `${colors.accent}15`,
            border: `2px solid ${colors.accent}`,
            borderRadius: '12px',
            padding: '1.125rem 2rem',
            fontSize: '1rem',
            fontWeight: 500,
            fontFamily: 'var(--font-inter), sans-serif',
            cursor: 'pointer',
            minHeight: '52px',
            transition: 'all 0.3s ease',
            boxShadow: `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`,
            transform: 'scale(1.1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 0 60px ${colors.accent}90, 0 0 120px ${colors.accent}70, 0 0 160px ${colors.accent}50`;
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.backgroundColor = `${colors.accent}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
          }}
        >
          Start Free Trial
        </button>
        <p
          style={{
            color: colors.text,
            opacity: 0.7,
            fontSize: '0.875rem',
            fontFamily: 'var(--font-inter), sans-serif',
          }}
        >
          No credit card required
        </p>
      </div>
    </div>
  );
}
