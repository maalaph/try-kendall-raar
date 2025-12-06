'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';

interface CallDurationStepProps {
  selectedDuration: string | null;
  onSelect: (duration: string) => void;
  shouldAnimate?: boolean;
}

const durationLabels = ['0', '1', '2', '3', '4', '5'];

export default function CallDurationStep({
  selectedDuration,
  onSelect,
  shouldAnimate = false,
}: CallDurationStepProps) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
      if (shouldAnimate) {
        setIsVisible(false);
        // Animate after CallVolumeStep (2500ms) + 500ms delay
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3000);
        return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [shouldAnimate]);

  const getNumericValue = (duration: string | null): number => {
    if (!duration) return 0;
    const directNumber = parseFloat(duration);
    if (!isNaN(directNumber)) {
      return directNumber;
    }
    return 0;
  };

  const initialValue = getNumericValue(selectedDuration);
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
  const maxValue = 5;

  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  const updateSliderVisual = (value: number) => {
    if (!thumbRef.current || !trackFillRef.current) return;
    let percentage: number;
    if (value >= 5) {
      percentage = 100;
    } else {
      percentage = (value / 5) * 100;
    }
    thumbRef.current.style.left = `${percentage}%`;
    trackFillRef.current.style.width = `${percentage}%`;
  };

  useEffect(() => {
    if (selectedDuration && !isDragging && !isTyping) {
      const directNumber = parseFloat(selectedDuration);
      if (!isNaN(directNumber)) {
        setLocalValue(directNumber);
        localValueRef.current = directNumber;
        const sliderValue = directNumber > 5 ? 5 : directNumber;
        updateSliderVisual(sliderValue);
      } else {
        const newValue = getNumericValue(selectedDuration);
        setLocalValue(newValue);
        localValueRef.current = newValue;
        const sliderValue = newValue > 5 ? 5 : newValue;
        updateSliderVisual(sliderValue);
      }
    }
  }, [selectedDuration, isDragging, isTyping]);

  const getValueFromPosition = (clientX: number): number => {
    if (!sliderRef.current) return 0;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percentage = x / rect.width;
    percentage = Math.max(0, Math.min(1, percentage));
    const mappedValue = percentage * 5;
    return Math.min(5, mappedValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const newValue = getValueFromPosition(e.clientX);
    const cappedValue = Math.max(0, Math.min(5, Math.round(newValue * 100) / 100));
    localValueRef.current = cappedValue;
    updateSliderVisual(cappedValue);
    setLocalValue(cappedValue);
    onSelect(String(cappedValue));
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
      const cappedValue = Math.max(0, Math.min(5, Math.round(newValue * 100) / 100));

      if (Math.abs(cappedValue - localValueRef.current) > 0.01) {
        localValueRef.current = cappedValue;
        updateSliderVisual(cappedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(cappedValue);
          onSelect(String(cappedValue));
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
      const cappedValue = Math.max(0, Math.min(5, Math.round(newValue * 100) / 100));

      if (Math.abs(cappedValue - localValueRef.current) > 0.01) {
        localValueRef.current = cappedValue;
        updateSliderVisual(cappedValue);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setLocalValue(cappedValue);
          onSelect(String(cappedValue));
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
            const cappedValue = Math.max(0, Math.min(5, targetValue));
            setLocalValue(cappedValue);
            localValueRef.current = cappedValue;
            updateSliderVisual(cappedValue);
            onSelect(formatDuration(cappedValue)); // Use formatDuration to ensure 2 decimal places
          };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = getValueFromPosition(touch.clientX);
    const cappedValue = Math.min(5, Math.round(newValue * 100) / 100);
    setLocalValue(cappedValue);
    localValueRef.current = cappedValue;
    updateSliderVisual(cappedValue);
    onSelect(String(cappedValue));
  };

  const formatDuration = (value: number): string => {
    if (value === 0) return '0.00';
    if (value >= 5) return '5.00';
    return value.toFixed(2);
  };

  return (
    <div 
      className="w-full"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) translateY(0)' : 'translateX(20px) translateY(-5px)',
        transition: 'opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <h3
        style={{
          color: colors.text,
          fontSize: '1.25rem',
          fontWeight: 500,
          fontFamily: 'var(--font-inter), sans-serif',
          marginBottom: '1.5rem',
          marginTop: '0',
          paddingTop: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'nowrap',
        }}
      >
        <span style={{ minWidth: 'clamp(200px, 25vw, 280px)' }}>How long are your calls? (mins)</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={isTyping ? inputValue : (localValue === 0 ? '' : formatDuration(localValue))}
          placeholder="0.00"
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

            if (/^\d*\.?\d*$/.test(value)) {
              // Allow partial decimal input while typing (e.g., "3.", "3.3", "3.33")
              if (value === '.' || value.endsWith('.')) {
                // Keep the raw value while typing, don't parse yet
                return;
              }

              const numValue = parseFloat(value);
              // Allow any value >= 0 in input (no upper limit), but cap slider visual at 5
              if (!isNaN(numValue) && numValue >= 0) {
                const sliderValue = Math.min(5, numValue);
                setLocalValue(sliderValue);
                localValueRef.current = sliderValue;
                updateSliderVisual(sliderValue);
                // Store the actual value (can be > 5 or decimal)
                onSelect(value);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
              return;
            }
            if (!/[0-9.]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
            }
          }}
          onClick={(e) => {
            e.currentTarget.select();
          }}
          onFocus={(e) => {
            setIsTyping(true);
            const currentVal = localValue === 0 ? '' : formatDuration(localValue);
            setInputValue(currentVal);
            e.currentTarget.select();
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}50`;
            e.currentTarget.style.borderColor = colors.accent;
          }}
          onBlur={(e) => {
            setIsTyping(false);
            setInputValue('');
            e.currentTarget.style.boxShadow = 'none';
            const value = e.target.value.trim();
            if (value === '' || value === '.' || value === '0.') {
              setLocalValue(0);
              localValueRef.current = 0;
              updateSliderVisual(0);
              onSelect('0.00');
            } else {
              const numValue = parseFloat(value);
              if (!isNaN(numValue) && numValue >= 0) {
                // Allow any value >= 0, but cap slider visual at 5
                const sliderValue = Math.min(5, numValue);
                setLocalValue(sliderValue);
                localValueRef.current = sliderValue;
                updateSliderVisual(sliderValue);
                // Store actual value (can be > 5)
                onSelect(value);
              } else {
                setLocalValue(localValueRef.current);
                onSelect(formatDuration(localValueRef.current));
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
            flexShrink: 0,
          }}
        />
      </h3>

      <div className="space-y-4">
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

          {durationLabels.map((label, index) => {
            let position: number;
            let targetValue: number;

            if (index === 0) {
              position = 0;
              targetValue = 0;
            } else if (index === durationLabels.length - 1) {
              position = 100;
              targetValue = 5;
            } else {
              position = (index / (durationLabels.length - 1)) * 100;
              targetValue = index;
            }

            const adjustedTop = 'calc(50% + 28px)';

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
                  top: adjustedTop,
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85';
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
