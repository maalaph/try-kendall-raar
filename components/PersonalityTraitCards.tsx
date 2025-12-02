'use client';

import React from 'react';
import QuestionCard from './QuestionCard';
import { colors } from '@/lib/config';
import { Heart, Briefcase, Crown, Sparkles, Zap, MessageSquare, Lightbulb, CheckCircle } from 'lucide-react';

interface PersonalityTraitCardsProps {
  selectedTraits: string[];
  onSelectionChange: (traits: string[]) => void;
  maxSelections?: number;
}

const PERSONALITY_TRAITS = [
  'Friendly',
  'Professional',
  'Confident',
  'Witty',
  'Rude',
  'Sarcastic',
  'Arrogant',
  'Blunt',
  'Sassy',
];

// Custom speech bubble icon for Rude trait
const RudeIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  const iconColor = color || colors.text;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Speech bubble - wider to fit text better */}
        <path
          d="M6 4C3.23858 4 1 6.23858 1 9V27C1 29.7614 3.23858 32 6 32H12V40L20 32H38C40.7614 32 43 29.7614 43 27V9C43 6.23858 40.7614 4 38 4H6Z"
          stroke={iconColor}
          strokeWidth={strokeWidth * 1.3}
          fill="transparent"
        />
        {/* Triangle tail - larger */}
        <path
          d="M12 32L4 40V32H12Z"
          stroke={iconColor}
          strokeWidth={strokeWidth * 1.3}
          fill="transparent"
        />
        {/* Text - larger and better positioned with more space */}
        <text
          x="22"
          y="22"
          fontSize="14"
          fontWeight="700"
          fill={iconColor}
          fontFamily="var(--font-inter), sans-serif"
          textAnchor="middle"
        >
          F***
        </text>
      </svg>
    </div>
  );
};

// Custom "Ha ha" text icon for Sarcastic trait
const SarcasticIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  // Always use full opacity accent color for vibrant text
  const iconColor = colors.accent;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 70 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Ha ha text - larger and vibrant, fully visible */}
        <text
          x="35"
          y="30"
          fontSize="24"
          fontWeight="700"
          fill={iconColor}
          fillOpacity="1"
          fontFamily="var(--font-inter), sans-serif"
          textAnchor="middle"
          letterSpacing="2"
        >
          Ha ha
        </text>
      </svg>
    </div>
  );
};

// Tilted crown icon wrapper for Arrogant trait
const ArrogantIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, transform: 'rotate(-18deg)' }}>
      <Crown size={size} color={color} strokeWidth={strokeWidth} />
    </div>
  );
};


// Custom nail polish icon for Sassy trait
const SassyIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  const iconColor = color || colors.text;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hand outline */}
        <path
          d="M16 38 L16 34 L18 30 L20 26 L22 22 L24 18 L26 14 L28 12 L30 10 L32 8 L34 10 L36 12 L38 14 L38 16 L36 18 L34 20 L32 22 L30 24 L28 26 L26 28 L24 30 L22 32 L20 34 L18 36 L16 38 Z"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Thumb */}
        <path
          d="M16 38 Q14 36 12 36 Q10 38 12 40 Q14 42 16 40"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Polished nails - rounded rectangles at fingertips */}
        <rect x="26" y="8" width="6" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="30" y="12" width="6" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="32" y="16" width="5" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="34" y="20" width="4" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="12" y="38" width="5" height="3" rx="1" fill={iconColor} opacity="0.9" />
        {/* Wrist band/line */}
        <line
          x1="18"
          y1="38"
          x2="22"
          y2="38"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

// Function to get icon for a trait
const getTraitIcon = (trait: string): React.ReactNode => {
  const iconProps = { size: 40 }; // Increased from 32 to 40 for better prominence
  
  switch (trait) {
    case 'Friendly':
      return <Heart {...iconProps} />;
    case 'Professional':
      return <Briefcase {...iconProps} />;
    case 'Confident':
      return <CheckCircle {...iconProps} />;
    case 'Witty':
      return <Lightbulb {...iconProps} />;
    case 'Rude':
      return <RudeIcon {...iconProps} />;
    case 'Sarcastic':
      return <SarcasticIcon {...iconProps} />;
    case 'Arrogant':
      return <ArrogantIcon {...iconProps} />;
    case 'Blunt':
      return <Zap {...iconProps} />;
    case 'Sassy':
      return <Sparkles {...iconProps} />;
    default:
      return null;
  }
};

export default function PersonalityTraitCards({
  selectedTraits,
  onSelectionChange,
  maxSelections = 3,
}: PersonalityTraitCardsProps) {

  const handleTraitClick = (trait: string) => {
    // Validate trait
    if (!trait || typeof trait !== 'string' || !trait.trim()) {
      console.error('[TRAIT CARDS] Invalid trait:', trait);
      return;
    }

    if (selectedTraits.includes(trait)) {
      // Deselect
      onSelectionChange(selectedTraits.filter(t => t !== trait));
    } else {
      // Select if under max
      if (selectedTraits.length < maxSelections) {
        onSelectionChange([...selectedTraits, trait]);
      }
    }
  };

  const isMaxedOut = selectedTraits.length >= maxSelections;

  return (
    <div className="w-full" style={{ paddingBottom: '2rem' }}>
      {/* Selection counter */}
      {selectedTraits.length > 0 && (
        <div
          className="mb-6 text-center"
          style={{
            color: colors.accent,
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
          }}
        >
          {selectedTraits.length} of {maxSelections} selected
          {selectedTraits.length === maxSelections && (
            <span className="ml-2">✓</span>
          )}
        </div>
      )}
      
      {/* Cards grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        style={{ width: '100%' }}
      >
        {PERSONALITY_TRAITS.map((trait) => {
          const isSelected = selectedTraits.includes(trait);
          const isDisabled = isMaxedOut && !isSelected;
          
          // Progressive darkening based on number of selections
          // 1 selected: 0.7, 2 selected: 0.5, 3 selected: 0.4
          let cardOpacity: number | undefined = undefined;
          if (!isSelected && selectedTraits.length > 0) {
            if (selectedTraits.length === 1) {
              cardOpacity = 0.7; // Slightly darker
            } else if (selectedTraits.length === 2) {
              cardOpacity = 0.5; // Darker
            } else if (selectedTraits.length === 3) {
              cardOpacity = 0.4; // Darkest (maxed out)
            }
          }
          
          return (
            <QuestionCard
              key={trait}
              label={trait}
              icon={getTraitIcon(trait)}
              selected={isSelected}
              onClick={() => handleTraitClick(trait)}
              disabled={isDisabled}
              opacity={cardOpacity}
            />
          );
        })}
      </div>
    </div>
  );
}

