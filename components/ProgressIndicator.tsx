'use client';

import { colors } from '@/lib/config';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepNames?: string[];
}

export default function ProgressIndicator({ currentStep, totalSteps, stepNames }: ProgressIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  
  return (
    <div className="w-full mb-6 sm:mb-8" style={{ position: 'relative' }}>
      {/* Progress bar background with centered dots */}
      <div
        className="w-full rounded-full"
        style={{
          height: '6px',
          backgroundColor: `${colors.secondary}`,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Progress bar fill */}
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            backgroundColor: colors.accent,
            boxShadow: `0 0 10px ${colors.accent}80`,
          }}
        />
        
        {/* Step dots - centered on the timeline */}
        <div className="absolute inset-0 flex justify-between items-center" style={{ pointerEvents: 'none' }}>
          {steps.map((step) => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            
            return (
              <div
                key={step}
                className="rounded-full transition-all duration-300"
                style={{
                  width: isCurrent ? '18px' : '14px',
                  height: isCurrent ? '18px' : '14px',
                  backgroundColor: isCompleted || isCurrent ? colors.accent : colors.secondary,
                  border: `2px solid ${isCompleted || isCurrent ? colors.accent : colors.secondary}`,
                  boxShadow: isCurrent 
                    ? `0 0 12px ${colors.accent}, 0 0 24px ${colors.accent}40`
                    : isCompleted
                    ? `0 0 8px ${colors.accent}40`
                    : 'none',
                  animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                  transform: 'translateY(-50%)',
                  marginTop: '3px', // Half of 6px to center perfectly
                }}
              />
            );
          })}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

