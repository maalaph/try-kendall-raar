'use client';

import React from 'react';
import { colors } from '@/lib/config';

interface QuestionCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
  opacity?: number;
}

export default function QuestionCard({
  label,
  selected,
  onClick,
  disabled = false,
  icon,
  description,
  className = '',
  opacity,
}: QuestionCardProps) {
  // Use custom opacity if provided, otherwise use disabled state opacity
  const cardOpacity = opacity !== undefined ? opacity : (disabled ? 0.4 : 1);
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative transition-all duration-300 ease-out ${className}`}
      style={{
        padding: className.includes('compact-card') 
          ? 'clamp(0.6rem, 1.2vw, 0.85rem)' 
          : 'clamp(1rem, 2vw, 1.5rem)',
        backgroundColor: selected 
          ? `${colors.accent}20` 
          : 'rgba(8, 8, 10, 0.92)',
        backgroundImage: selected
          ? `linear-gradient(135deg, ${colors.accent}40 0%, ${colors.accent}15 35%, rgba(0, 0, 0, 0.9) 100%)`
          : `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`,
        border: `2px solid ${selected ? colors.accent : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: cardOpacity,
        transform: selected ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: selected
          ? `0 8px 32px ${colors.accent}50, 0 0 30px ${colors.accent}40, inset 0 0 20px ${colors.accent}10`
          : '0 4px 16px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'visible',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !selected) {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent}30`;
          e.currentTarget.style.backgroundColor = 'rgba(8, 8, 10, 0.92)';
          e.currentTarget.style.backgroundImage = `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
          e.currentTarget.style.backgroundColor = 'rgba(8, 8, 10, 0.92)';
          e.currentTarget.style.backgroundImage = `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`;
        }
      }}
    >
      {/* Animated glow border for selected state */}
      {selected && (
        <>
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              border: `2px solid ${colors.accent}`,
              borderRadius: '16px',
              animation: 'glow-pulse 2s ease-in-out infinite',
              boxShadow: `
                0 0 20px ${colors.accent}60,
                0 0 40px ${colors.accent}40,
                inset 0 0 20px ${colors.accent}20
              `,
            }}
          />
          {/* Inner glow effect */}
          <div
            className="absolute inset-[2px] rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${colors.accent}10 0%, transparent 70%)`,
              animation: 'glow-inner 2s ease-in-out infinite',
            }}
          />
        </>
      )}
      
      {/* Icon */}
      {icon && (
        <div 
          className={`${className.includes('compact-card') ? 'mb-1.5' : 'mb-4'} flex items-center justify-center transition-all duration-300`} 
          style={{ 
            opacity: selected ? 1 : 0.9,
            filter: selected 
              ? `drop-shadow(0 0 20px ${colors.accent}100) drop-shadow(0 0 12px ${colors.accent}90) drop-shadow(0 0 8px ${colors.accent}70) brightness(1.2)` 
              : `drop-shadow(0 0 12px ${colors.accent}70) drop-shadow(0 0 8px ${colors.accent}50) drop-shadow(0 0 4px ${colors.accent}40)`,
            background: 'transparent',
            borderRadius: '12px',
            padding: '0.75rem',
            transform: selected ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: selected ? colors.accent : `${colors.accent}CC`,
            transition: 'all 0.3s ease',
            width: '48px',
            height: '48px',
            position: 'relative',
          }}>
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<any>, {
                  color: selected ? colors.accent : `${colors.accent}CC`,
                  strokeWidth: selected ? 2.5 : 2,
                  size: selected ? 44 : 40,
                })
              : icon}
          </div>
        </div>
      )}
      
      {/* Label */}
      <div
        className="font-medium mb-1"
        style={{
          color: colors.text,
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: className.includes('compact-card') 
            ? 'clamp(0.875rem, 1.5vw, 1rem)' 
            : 'clamp(1rem, 2vw, 1.125rem)',
          textAlign: 'center',
          fontWeight: selected ? 600 : 500,
        }}
      >
        {label}
      </div>
      
      {/* Description */}
      {description && (
        <div
          className={className.includes('compact-card') ? 'text-xs' : 'text-sm'}
          style={{
            color: colors.text,
            opacity: selected ? 0.8 : 0.7,
            fontFamily: 'var(--font-inter), sans-serif',
            textAlign: 'center',
          }}
        >
          {description}
        </div>
      )}
    </button>
  );
}

