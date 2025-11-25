'use client';

import { useEffect, useState } from 'react';

interface WizardStepProps {
  isActive: boolean;
  children: React.ReactNode;
}

export default function WizardStep({ isActive, children }: WizardStepProps) {
  const [isVisible, setIsVisible] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isVisible) return null;

  return (
    <div
      className="wizard-step"
      style={{
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    >
      {children}
    </div>
  );
}

