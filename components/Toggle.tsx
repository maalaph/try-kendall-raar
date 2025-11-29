'use client';

import { useState } from 'react';
import { colors } from '@/lib/config';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    
    setIsAnimating(true);
    setIsPressed(true);
    onChange(!checked);
    
    setTimeout(() => {
      setIsAnimating(false);
      setIsPressed(false);
    }, 300);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="relative touch-manipulation w-full"
        style={{
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          border: 'none',
          background: 'transparent',
          padding: 0,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsPressed(true);
        }}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onFocus={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        <div
          className="relative flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 cursor-pointer"
          style={{
            backgroundColor: colors.secondary,
            border: '2px solid transparent',
            transform: isPressed ? 'scale(0.98)' : 'scale(1)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Toggle Switch */}
          <div
            className="relative flex-shrink-0 transition-all duration-300 ease-out"
            style={{
              width: '60px',
              height: '32px',
              transform: isAnimating && checked 
                ? 'scale(1.2)' 
                : isAnimating 
                ? 'scale(0.9)' 
                : isPressed 
                ? 'scale(0.95)' 
                : 'scale(1)',
            }}
          >
            {/* Track */}
            <div
              className="absolute inset-0 rounded-full transition-all duration-300 ease-out"
              style={{
                backgroundColor: checked ? colors.accent : '#333333',
                boxShadow: checked
                  ? `inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 20px ${colors.accent}60, 0 0 40px ${colors.accent}40`
                  : 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
              }}
            />
            
            {/* Glow effect when checked */}
            {checked && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${colors.accent}80 0%, transparent 70%)`,
                  animation: 'toggle-glow 1.5s ease-in-out infinite',
                  opacity: 0.6,
                }}
              />
            )}
            
            {/* Thumb */}
            <div
              className="absolute top-1 left-1 w-6 h-6 rounded-full transition-all duration-300 ease-out pointer-events-none"
              style={{
                backgroundColor: checked ? '#FFFFFF' : '#CCCCCC',
                transform: checked ? 'translateX(28px)' : 'translateX(0)',
                boxShadow: checked
                  ? `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px ${colors.accent}80, 0 0 30px ${colors.accent}60, inset 0 1px 2px rgba(255, 255, 255, 0.6)`
                  : '0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
                transformOrigin: 'center',
                scale: isAnimating && checked ? 1.25 : isAnimating ? 0.85 : 1,
              }}
            >
              {/* Inner glow on thumb when checked */}
              {checked && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), transparent 70%)`,
                    opacity: 0.8,
                  }}
                />
              )}
            </div>

            {/* Ripple effect on click */}
            {isAnimating && (
              <>
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${colors.accent}40 0%, transparent 70%)`,
                    animation: 'toggle-success-pulse 0.6s ease-out',
                    transform: 'scale(1)',
                  }}
                />
                {/* Secondary ripple for more depth */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`,
                    animation: 'toggle-success-pulse 0.8s ease-out 0.1s',
                    transform: 'scale(1)',
                  }}
                />
              </>
            )}
          </div>

          {/* Label Content */}
          {(label || description) && (
            <div className="flex-1 text-left">
              {label && (
                <div
                  className="text-base font-medium mb-1"
                  style={{
                    color: colors.text,
                    opacity: checked ? 1 : 0.9,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {label}
                </div>
              )}
              {description && (
                <div
                  className="text-sm"
                  style={{
                    color: colors.text,
                    opacity: checked ? 0.7 : 0.6,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {description}
                </div>
              )}
            </div>
          )}
        </div>
      </button>

      <style jsx>{`
        @keyframes toggle-glow {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.1);
          }
        }
        
        @keyframes toggle-success-pulse {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

