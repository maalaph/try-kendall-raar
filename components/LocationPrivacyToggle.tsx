'use client';

/**
 * Location Privacy Toggle (Ghost Mode)
 * When enabled, AI cannot access user's location
 */

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

interface LocationPrivacyToggleProps {
  userId: string;
  initialEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  compact?: boolean;
}

export default function LocationPrivacyToggle({
  userId,
  initialEnabled = true,
  onToggle,
  compact = false,
}: LocationPrivacyToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial state from server
  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch(`/api/location/privacy?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.location_enabled ?? true);
        }
      } catch (error) {
        console.warn('[LocationPrivacy] Failed to fetch state:', error);
      }
    };

    if (userId) {
      fetchState();
    }
  }, [userId]);

  const handleToggle = async () => {
    const newValue = !enabled;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/location/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          location_enabled: newValue,
        }),
      });

      if (response.ok) {
        setEnabled(newValue);
        onToggle?.(newValue);
      }
    } catch (error) {
      console.error('[LocationPrivacy] Failed to update:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className="flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200"
        style={{
          background: enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${enabled ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
          opacity: isLoading ? 0.6 : 1,
        }}
        title={enabled ? 'Location sharing enabled' : 'Ghost Mode: Location hidden'}
      >
        <span className="text-sm">{enabled ? '📍' : '👻'}</span>
        <span className="text-xs" style={{ color: enabled ? '#22c55e' : '#ef4444' }}>
          {enabled ? 'On' : 'Ghost'}
        </span>
      </button>
    );
  }

  return (
    <div 
      className="p-4 rounded-xl"
      style={{ 
        background: colors.primary,
        border: `1px solid ${colors.secondary}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{
              background: enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            }}
          >
            {enabled ? '📍' : '👻'}
          </div>
          <div>
            <h3 className="font-medium" style={{ color: colors.text }}>
              Location Sharing
            </h3>
            <p className="text-sm" style={{ color: colors.text, opacity: 0.7 }}>
              {enabled 
                ? 'Kendall can access your location for recommendations'
                : 'Ghost Mode: Your location is hidden from Kendall'
              }
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className="relative w-14 h-7 rounded-full transition-all duration-300"
          style={{
            background: enabled ? '#22c55e' : '#374151',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <div
            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300"
            style={{
              left: enabled ? '32px' : '4px',
            }}
          />
        </button>
      </div>
      
      {!enabled && (
        <div 
          className="mt-3 p-2 rounded-lg text-sm"
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
          }}
        >
          ⚠️ Location-based features (nearby places, directions, etc.) won't work while Ghost Mode is active.
        </div>
      )}
    </div>
  );
}

