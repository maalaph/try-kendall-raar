'use client';

/**
 * Location Label Input Component
 * Autocomplete with common labels + free-form text input for custom labels
 */

import { useState, useEffect, useRef } from 'react';
import { colors } from '@/lib/config';

interface LocationLabelInputProps {
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const COMMON_LABELS = [
  'Home',
  'Work',
  'Gym',
  'Coffee Shop',
  "Mom's House",
  "Dad's House",
  'School',
  'University',
  'Hospital',
  'Airport',
  'Hotel',
  'Restaurant',
  'Park',
  'Beach',
  'Library',
  'Store',
  'Gas Station',
  'Bank',
  'Office',
  'Studio',
  'Salon',
  'Barbershop',
];

const LABEL_ICONS: Record<string, string> = {
  'Home': '🏠',
  'Work': '🏢',
  'Gym': '💪',
  'Coffee Shop': '☕',
  "Mom's House": '👩',
  "Dad's House": '👨',
  'School': '🎓',
  'University': '🎓',
  'Hospital': '🏥',
  'Airport': '✈️',
  'Hotel': '🏨',
  'Restaurant': '🍽️',
  'Park': '🌳',
  'Beach': '🏖️',
  'Library': '📚',
  'Store': '🛍️',
  'Gas Station': '⛽',
  'Bank': '🏦',
  'Office': '🏢',
  'Studio': '🎨',
  'Salon': '💇',
  'Barbershop': '✂️',
};

export default function LocationLabelInput({
  value,
  onChange,
  placeholder = 'Enter location label...',
  disabled = false,
  className = '',
}: LocationLabelInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredLabels, setFilteredLabels] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    // Filter labels based on input
    if (inputValue.trim() === '') {
      setFilteredLabels(COMMON_LABELS.slice(0, 8));
      setShowSuggestions(true);
    } else {
      const filtered = COMMON_LABELS.filter(label =>
        label.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredLabels(filtered);
      setShowSuggestions(filtered.length > 0 || inputValue.trim() !== '');
    }
  }, [inputValue]);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSelectLabel = (label: string) => {
    setInputValue(label);
    onChange(label);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const getIcon = (label: string): string => {
    // Check exact match first
    if (LABEL_ICONS[label]) {
      return LABEL_ICONS[label];
    }
    
    // Check partial match
    const lowerLabel = label.toLowerCase();
    for (const [key, icon] of Object.entries(LABEL_ICONS)) {
      if (lowerLabel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerLabel)) {
        return icon;
      }
    }
    
    // Default icon
    return '📍';
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">
          {getIcon(inputValue)}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2.5 text-sm transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: colors.secondary,
            color: colors.text,
            border: `1px solid ${colors.secondary}`,
            borderRadius: '0',
          }}
          onFocus={(e) => {
            setShowSuggestions(true);
            if (!disabled) {
              e.currentTarget.style.borderColor = colors.accent;
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = colors.secondary;
          }}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto"
          style={{
            backgroundColor: colors.primary,
            border: `1px solid ${colors.secondary}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {filteredLabels.length > 0 ? (
            filteredLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => handleSelectLabel(label)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-opacity-50 transition-colors"
                style={{
                  backgroundColor: 'transparent',
                  color: colors.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span className="text-lg">{LABEL_ICONS[label] || '📍'}</span>
                <span>{label}</span>
              </button>
            ))
          ) : (
            <div
              className="px-4 py-3 text-sm text-center"
              style={{ color: colors.text, opacity: 0.6 }}
            >
              Custom label: "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}



