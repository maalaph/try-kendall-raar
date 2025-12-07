'use client';

/**
 * Location Suggestion Card Component
 * Shows proactive location suggestions on dashboard
 */

import { useState } from 'react';
import { colors } from '@/lib/config';
import LocationSuggestionModal from './LocationSuggestionModal';

export interface LocationSuggestion {
  id: string;
  userId: string;
  clusterId: number;
  suggestedLabel?: string;
  address?: string;
  latitude: number;
  longitude: number;
  confidenceScore: number;
  visitCount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
  createdAt: string;
}

interface LocationSuggestionCardProps {
  suggestion: LocationSuggestion;
  onAccept?: (suggestionId: string, customLabel: string) => void;
  onReject?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
  className?: string;
}

export default function LocationSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onDismiss,
  className = '',
}: LocationSuggestionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuickAccept = async () => {
    if (!onAccept) return;
    
    setIsProcessing(true);
    try {
      await onAccept(suggestion.id, suggestion.suggestedLabel || 'Custom Location');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickReject = async () => {
    if (!onReject) return;
    
    setIsProcessing(true);
    try {
      await onReject(suggestion.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const confidencePercentage = Math.round(suggestion.confidenceScore * 100);

  return (
    <>
      <div
        className={`p-4 rounded-xl transition-all duration-200 ${className}`}
        style={{
          backgroundColor: colors.secondary,
          border: `1px solid ${colors.accent}40`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📍</span>
              <h3
                className="font-medium text-sm"
                style={{ color: colors.text }}
              >
                Location Pattern Detected
              </h3>
            </div>
            
            <p
              className="text-sm mb-2"
              style={{ color: colors.text, opacity: 0.9 }}
            >
              I noticed you're often at{' '}
              <span className="font-medium">
                {suggestion.address || `${suggestion.latitude.toFixed(4)}, ${suggestion.longitude.toFixed(4)}`}
              </span>
            </p>
            
            {suggestion.suggestedLabel && (
              <p
                className="text-xs mb-3"
                style={{ color: colors.text, opacity: 0.7 }}
              >
                Suggested label: <span className="font-medium">{suggestion.suggestedLabel}</span>
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs" style={{ color: colors.text, opacity: 0.6 }}>
              <span>{suggestion.visitCount} visits</span>
              <span>•</span>
              <span>{confidencePercentage}% confidence</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 text-xs rounded transition-colors"
              style={{
                backgroundColor: colors.accent,
                color: colors.primary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Review
            </button>
            
            <div className="flex gap-1">
              <button
                onClick={handleQuickAccept}
                disabled={isProcessing}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                  opacity: isProcessing ? 0.5 : 1,
                }}
                title="Quick accept"
              >
                ✓
              </button>
              <button
                onClick={handleQuickReject}
                disabled={isProcessing}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  opacity: isProcessing ? 0.5 : 1,
                }}
                title="Quick reject"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <LocationSuggestionModal
          suggestion={suggestion}
          onClose={() => setShowModal(false)}
          onAccept={onAccept}
          onReject={onReject}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
}

