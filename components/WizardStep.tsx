'use client';

import { useEffect, useState } from 'react';

interface WizardStepProps {
  isActive: boolean;
  children: React.ReactNode;
}

export default function WizardStep({ isActive, children }: WizardStepProps) {
  const [isVisible, setIsVisible] = useState(isActive);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isActive) {
      // When becoming active, ensure visibility and reset exit state
      setIsExiting(false);
      setIsVisible(true);
    } else {
      // When becoming inactive, start exit animation
      setIsExiting(true);
      // Hide after exit animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isVisible) return null;

  return (
    <div
      className="wizard-step"
      style={{
        opacity: isActive ? 1 : 0,
        transform: isActive 
          ? 'translateX(0) scale(1)' 
          : isExiting
          ? 'translateX(100%) scale(0.95)'
          : 'translateX(100%) scale(0.95)',
        transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: isActive ? 10 : isExiting ? 5 : 1,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}


