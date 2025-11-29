'use client';

import React from 'react';
import QuestionCard from './QuestionCard';
import { colors } from '@/lib/config';
import { Users, Smartphone, Briefcase, Handshake, Globe } from 'lucide-react';

interface UseCaseCardsProps {
  selectedUseCase: string | null;
  onSelectionChange: (useCase: string) => void;
}

const USE_CASES = [
  {
    value: 'Friends & Personal Life',
    label: 'Friends & Personal Life',
    description: 'Handle calls from friends, family, and personal contacts',
    icon: Users,
  },
  {
    value: 'Social Media / Instagram / TikTok',
    label: 'Social Media',
    description: 'Handle calls from fans and followers who find your number in your social media bio',
    icon: Smartphone,
  },
  {
    value: 'Professional / LinkedIn',
    label: 'Professional / LinkedIn',
    description: 'Handle professional networking and career-related calls',
    icon: Briefcase,
  },
  {
    value: 'Clients & Customers',
    label: 'Clients & Customers',
    description: 'Manage inquiries for solopreneurs',
    icon: Handshake,
  },
  {
    value: 'Mixed / Everything',
    label: 'All of the above',
    description: 'Handle all types of calls across different contexts',
    icon: Globe,
  },
];

export default function UseCaseCards({
  selectedUseCase,
  onSelectionChange,
}: UseCaseCardsProps) {
  const hasSelection = selectedUseCase !== null;

  return (
    <div className="w-full" style={{ paddingBottom: '0.5rem' }}>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
        style={{ width: '100%', maxWidth: '700px', margin: '0 auto' }}
      >
        {USE_CASES.map((useCase, index) => {
          const IconComponent = useCase.icon;
          const isLastCard = index === USE_CASES.length - 1;
          const isSelected = selectedUseCase === useCase.value;
          const isDarkened = hasSelection && !isSelected;
          
          return (
            <QuestionCard
              key={useCase.value}
              label={useCase.label}
              description={useCase.description}
              icon={<IconComponent size={36} />}
              selected={isSelected}
              disabled={isDarkened}
              onClick={() => {
                // Toggle selection - if already selected, deselect
                if (isSelected) {
                  onSelectionChange('');
                } else {
                  onSelectionChange(useCase.value);
                }
              }}
              className={`compact-card ${isLastCard ? 'col-span-1 sm:col-span-2' : ''}`}
            />
          );
        })}
      </div>
      
      {/* Helper text */}
      <p
        className="text-center text-sm"
        style={{
          color: colors.text,
          opacity: 0.6,
          fontFamily: 'var(--font-inter), sans-serif',
          marginTop: '2.5rem',
        }}
      >
        Choose the primary way your assistant will be used
      </p>
    </div>
  );
}

