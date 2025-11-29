'use client';

import React, { useMemo } from 'react';
import { colors } from '@/lib/config';
import { scorePromptQuality, getQualityBreakdown, type QualityScore } from '@/lib/promptQualityScorer';

interface VoiceQualityMeterProps {
  description: string;
  className?: string;
}

export default function VoiceQualityMeter({ description, className = '' }: VoiceQualityMeterProps) {
  const quality = useMemo(() => scorePromptQuality(description), [description]);
  const breakdown = useMemo(() => getQualityBreakdown(description), [description]);
  
  // Get color gradient based on quality level
  const getGradientColors = (level: QualityScore['level']) => {
    switch (level) {
      case 'poor':
        return {
          start: '#dc2626', // Deep red
          end: '#991b1b', // Dark red
          glow: 'rgba(220, 38, 38, 0.6)',
        };
      case 'fair':
        return {
          start: '#f97316', // Orange
          end: '#eab308', // Yellow
          glow: 'rgba(249, 115, 22, 0.5)',
        };
      case 'good':
        return {
          start: '#eab308', // Yellow
          end: '#22c55e', // Green
          glow: 'rgba(34, 197, 94, 0.5)',
        };
      case 'excellent':
        return {
          start: '#22c55e', // Green
          end: '#a855f7', // Purple (matches accent)
          glow: 'rgba(168, 85, 247, 0.6)',
        };
    }
  };
  
  const gradientColors = getGradientColors(quality.level);
  
  // Calculate glow intensity based on score
  const glowIntensity = quality.overall / 100;
  const pulseIntensity = quality.level === 'excellent' ? 1.2 : 1.0;
  
  return (
    <div className={`relative ${className}`}>
      {/* Gradient Orb */}
      <div
        className="relative cursor-pointer group"
        style={{
          width: '90px',
          height: '90px',
          margin: '0 auto',
        }}
      >
        {/* Outer glow layers */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${gradientColors.start}, ${gradientColors.end})`,
            filter: `blur(8px)`,
            opacity: glowIntensity * 0.6,
            animation: 'pulse-glow 2.5s ease-in-out infinite',
            transform: 'scale(1.1)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${gradientColors.start}, ${gradientColors.end})`,
            filter: `blur(4px)`,
            opacity: glowIntensity * 0.4,
            animation: 'pulse-glow 2.5s ease-in-out infinite',
            animationDelay: '0.5s',
            transform: 'scale(1.05)',
          }}
        />
        
        {/* Main orb */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${gradientColors.start} 0%, ${gradientColors.end} 70%, ${gradientColors.end} 100%)`,
            boxShadow: `
              0 0 20px ${gradientColors.glow},
              0 0 40px ${gradientColors.glow},
              inset 0 0 20px rgba(255, 255, 255, 0.1),
              inset -20px -20px 40px rgba(0, 0, 0, 0.3)
            `,
            animation: 'rotate-orb 10s linear infinite, pulse-orb 3s ease-in-out infinite',
            transform: 'perspective(500px) rotateX(5deg)',
          }}
        >
          {/* Score number */}
          <span
            className="text-white font-bold text-xl select-none"
            style={{
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
            }}
          >
            {quality.overall}
          </span>
        </div>
        
        {/* Shine effect */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.4) 0%, transparent 50%)',
            mixBlendMode: 'overlay',
            zIndex: 5,
          }}
        />
      </div>
      
      {/* Tooltip on hover */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50"
        style={{
          top: '100%',
          minWidth: '280px',
        }}
      >
        <div
          className="p-4 rounded-lg text-sm"
          style={{
            backgroundColor: colors.secondary,
            border: `1px solid ${colors.accent}40`,
            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`,
            color: colors.text,
          }}
        >
          <div className="font-semibold mb-2" style={{ color: colors.accent }}>
            Quality Score: {quality.overall}/100
          </div>
          
          <div className="space-y-2 text-xs">
            <div>
              <span className="opacity-70">Length:</span>{' '}
              <span style={{ color: quality.breakdown.length >= 20 ? colors.accent : '#ef4444' }}>
                {quality.breakdown.length}/25
              </span>
              {' '}
              <span className="opacity-60">({breakdown.length.current} chars)</span>
            </div>
            
            <div>
              <span className="opacity-70">Detail:</span>{' '}
              <span style={{ color: quality.breakdown.detail >= 24 ? colors.accent : '#ef4444' }}>
                {quality.breakdown.detail}/30
              </span>
              {breakdown.detail.found.length > 0 && (
                <span className="opacity-60 ml-1">
                  ({breakdown.detail.found.join(', ')})
                </span>
              )}
            </div>
            
            <div>
              <span className="opacity-70">Specificity:</span>{' '}
              <span style={{ color: quality.breakdown.specificity >= 20 ? colors.accent : '#ef4444' }}>
                {quality.breakdown.specificity}/25
              </span>
            </div>
            
            <div>
              <span className="opacity-70">Safety:</span>{' '}
              <span style={{ color: quality.breakdown.safety >= 18 ? colors.accent : '#ef4444' }}>
                {quality.breakdown.safety}/20
              </span>
            </div>
            
            {quality.suggestions.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: `${colors.accent}30` }}>
                <div className="font-semibold mb-1 text-xs" style={{ color: colors.accent }}>
                  Suggestions:
                </div>
                <ul className="list-disc list-inside space-y-1 opacity-80">
                  {quality.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-xs">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes rotate-orb {
          from { transform: perspective(500px) rotateX(5deg) rotateZ(0deg); }
          to { transform: perspective(500px) rotateX(5deg) rotateZ(360deg); }
        }
        @keyframes pulse-orb {
          0%, 100% { transform: perspective(500px) rotateX(5deg) scale(1); }
          50% { transform: perspective(500px) rotateX(5deg) scale(${pulseIntensity}); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: ${glowIntensity * 0.4}; }
          50% { opacity: ${glowIntensity * 0.8}; }
        }
      `}</style>
    </div>
  );
}

