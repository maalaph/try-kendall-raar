'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';

interface CallVolumeStepProps {
  selectedVolume: string | null;
  onSelect: (volume: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  businessType?: string | null;
  shouldAnimate?: boolean;
}

const volumeLabels = ['0', '10', '20', '30', '40', '50+'];

export default function CallVolumeStep({
  selectedVolume,
  onSelect,
  businessType,
  shouldAnimate = false,
}: CallVolumeStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (businessType) {
      if (shouldAnimate) {
        setIsVisible(false);
        // Calculate delay based on previous sections
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        // Keep hidden until animation starts
        setIsVisible(false);
      }
    }
  }, [businessType, shouldAnimate]);

  const getNumericValue = (volume: string | null): number => {
    if (!volume) return 0;
    const directNumber = parseInt(volume);
    if (!isNaN(directNumber)) {
      // Return the actual number, even if > 60
      return directNumber;
    }
    // Handle range formats if any
    const match = volume.match(/(\d+)-(\d+)/);
    if (match) {
      return (parseInt(match[1]) + parseInt(match[2])) / 2;
    }
    return 0;
  };

  const initialValue = getNumericValue(selectedVolume);
  const [localValue, setLocalValue] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackFillRef = useRef<HTMLDivElement>(null);
  const localValueRef = useRef(initialValue);
  const animationFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visualMaxValue = 100; // Visual max for slider display (100% of track)


  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    if (selectedVolume && !isDragging && !isTyping) {
      const directNumber = parseInt(selectedVolume);
      if (!isNaN(directNumber)) {
        // Cap slider visual at 50, but allow input to show values up to 500
        const sliderValue = Math.min(50, directNumber);
        setLocalValue(sliderValue);
        localValueRef.current = sliderValue;
        updateSliderVisual(sliderValue);
      } else {
        const newValue = getNumericValue(selectedVolume);
        const sliderValue = Math.min(50, newValue);
        setLocalValue(sliderValue);
        localValueRef.current = sliderValue;
        updateSliderVisual(sliderValue);
      }
    }
  }, [selectedVolume, isDragging, isTyping]);

  const updateSliderVisual = (value: number) => {
    if (!thumbRef.current || !trackFillRef.current) return;
    // Linear mapping for 0-50 across full slider track
    const maxValue = 50;
    const clampedValue = Math.max(0, Math.min(maxValue, value));
    const percentage = (clampedValue / maxValue) * 100;
    thumbRef.current.style.left = `${percentage}%`;
    trackFillRef.current.style.width = `${percentage}%`;
  };

  const getValueFromPosition = (clientX: number): number => {
    if (!sliderRef.current) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = x / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    
    // Map slider position to value - linear mapping from 0 to 50
    // Labels are evenly spaced: 0%, 20%, 40%, 60%, 80%, 100%
    // Values map linearly: 0, 10, 20, 30, 40, 50
    const maxValue = 50;
    const mappedValue = percentage * maxValue;
    return Math.max(0, Math.min(maxValue, Math.round(mappedValue)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const newValue = getValueFromPosition(e.clientX);
    const clampedValue = Math.max(0, Math.min(50, newValue)); // Cap at 50 for slider
    localValueRef.current = clampedValue;
    updateSliderVisual(clampedValue);
    setLocalValue(clampedValue);
    onSelect(String(clampedValue));
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
      const clampedValue = Math.max(0, Math.min(50, newValue)); // Cap at 50 for slider

      if (clampedValue !== localValueRef.current) {
        localValueRef.current = clampedValue;
        updateSliderVisual(clampedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(clampedValue);
          onSelect(String(clampedValue));
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
      const clampedValue = Math.max(0, Math.min(50, newValue)); // Cap at 50 for slider

      if (clampedValue !== localValueRef.current) {
        localValueRef.current = clampedValue;
        updateSliderVisual(clampedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(clampedValue);
          onSelect(String(clampedValue));
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
  }, [isDragging, onSelect]);

  const handleClick = (targetValue: number) => {
    // Clicking on labels sets to exact label value
    const clampedValue = Math.max(0, targetValue);
    setLocalValue(clampedValue);
    localValueRef.current = clampedValue;
    updateSliderVisual(clampedValue);
    onSelect(String(clampedValue));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = getValueFromPosition(touch.clientX);
    const clampedValue = Math.max(0, Math.min(50, newValue)); // Cap at 50 for slider
    setLocalValue(clampedValue);
    localValueRef.current = clampedValue;
    updateSliderVisual(clampedValue);
    onSelect(String(clampedValue));
  };

  return (
    <div 
      className="w-full"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(-30px) translateY(-10px)',
        transition: 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        marginBottom: '0.5rem',
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
          paddingTop: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ minWidth: 'clamp(200px, 25vw, 280px)' }}>How many calls do you receive per day?</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={isTyping 
            ? inputValue
            : (selectedVolume && parseInt(selectedVolume) > 50 
              ? String(parseInt(selectedVolume)) 
              : (localValue === 0 ? '' : String(Math.round(localValue))))}
          placeholder="0"
          onChange={(e) => {
            const value = e.target.value;
            setIsTyping(true);
            setInputValue(value);

            if (value === '') {
              setLocalValue(0);
              localValueRef.current = 0;
              updateSliderVisual(0);
              return;
            }

            if (/^\d*$/.test(value)) {
              const numValue = parseInt(value);
              // Allow values from 0 to 500 (or empty string while typing)
              if (value === '' || (!isNaN(numValue) && numValue >= 0 && numValue <= 500)) {
                if (value === '') {
                  return; // Keep showing empty string while typing
                }
                // Cap slider visual at 50, but store actual value up to 500
                const sliderValue = Math.min(50, numValue);
                setLocalValue(sliderValue);
                localValueRef.current = sliderValue;
                updateSliderVisual(sliderValue);
                // Store actual value (can be up to 500)
                onSelect(String(numValue));
              }
            }
          }}
          onMouseDown={(e) => {
            if (!selectedVolume) {
              setLocalValue(0);
              localValueRef.current = 0;
              updateSliderVisual(0);
              onSelect('0');
            }
          }}
          onFocus={(e) => {
            setIsTyping(true);
            const currentVal = selectedVolume ? String(parseInt(selectedVolume)) : (localValue === 0 ? '' : String(Math.round(localValue)));
            setInputValue(currentVal);
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}50`;
            e.currentTarget.style.borderColor = colors.accent;
          }}
          onBlur={(e) => {
            setIsTyping(false);
            setInputValue('');
            e.currentTarget.style.boxShadow = 'none';
            const value = e.target.value.trim();
            if (value === '') {
              setLocalValue(0);
              localValueRef.current = 0;
              updateSliderVisual(0);
              onSelect('0');
            } else {
              const numValue = parseInt(value);
              // Allow values from 0 to 500
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 500) {
                const sliderValue = Math.min(50, numValue);
                setLocalValue(sliderValue);
                localValueRef.current = sliderValue;
                updateSliderVisual(sliderValue);
                onSelect(String(numValue));
              }
            }
          }}
          style={{
            backgroundColor: `${colors.accent}15`,
            border: `2px solid ${colors.accent}`,
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            color: colors.text,
            fontFamily: 'var(--font-inter), sans-serif',
            width: '100px',
            textAlign: 'center',
            outline: 'none',
            transition: 'all 0.25s ease',
            cursor: 'text',
          }}
        />
      </h3>

      <div className="space-y-4" style={{ paddingBottom: '1.5rem' }}>
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
            marginBottom: '2.5rem', // Extra space for labels below
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
            // Equidistant spacing: 6 labels (0, 10, 20, 30, 40, 50+) evenly spaced across the track
            const totalLabels = volumeLabels.length;
            const position = (index / (totalLabels - 1)) * 100; // 0%, 20%, 40%, 60%, 80%, 100%
            
            // Map position to value
            let targetValue: number;
            if (index === 0) {
              targetValue = 0;
            } else if (index === totalLabels - 1) {
              targetValue = 50; // 50+ label
            } else {
              targetValue = index * 10; // 10, 20, 30, 40
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
                  top: 'calc(50% + 28px)',
                  transform: 'translateX(-50%)',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-inter), sans-serif',
                  color: colors.text,
                  opacity: 0.85,
                  transition: 'all 0.25s ease',
                  pointerEvents: 'auto',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = colors.accent;
                  e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85';
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
    </div>
  );
}

