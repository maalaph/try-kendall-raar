'use client';

/**
 * Location Suggestion Modal Component
 * Modal for accepting/rejecting location suggestions with custom label
 */

import { useState } from 'react';
import { colors } from '@/lib/config';
import LocationLabelInput from './LocationLabelInput';
import InteractiveMap, { MapMarker } from './InteractiveMap';

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

interface LocationSuggestionModalProps {
  suggestion: LocationSuggestion;
  onClose: () => void;
  onAccept?: (suggestionId: string, customLabel: string) => void;
  onReject?: (suggestionId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

export default function LocationSuggestionModal({
  suggestion,
  onClose,
  onAccept,
  onReject,
  onDismiss,
}: LocationSuggestionModalProps) {
  const [customLabel, setCustomLabel] = useState(suggestion.suggestedLabel || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    if (!customLabel.trim()) {
      alert('Please enter a label for this location');
      return;
    }

    if (!onAccept) return;

    setIsProcessing(true);
    try {
      await onAccept(suggestion.id, customLabel.trim());
      onClose();
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      alert('Failed to accept suggestion. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;

    setIsProcessing(true);
    try {
      await onReject(suggestion.id);
      onClose();
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      alert('Failed to reject suggestion. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) {
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      await onDismiss(suggestion.id);
      onClose();
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const confidencePercentage = Math.round(suggestion.confidenceScore * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6"
        style={{
          backgroundColor: colors.primary,
          border: `1px solid ${colors.secondary}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded transition-colors"
          style={{
            color: colors.text,
            opacity: 0.7,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.backgroundColor = colors.secondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2
            className="text-xl font-medium mb-2"
            style={{ color: colors.text }}
          >
            Save This Location?
          </h2>
          <p
            className="text-sm"
            style={{ color: colors.text, opacity: 0.8 }}
          >
            I noticed you've visited this location {suggestion.visitCount} time{suggestion.visitCount !== 1 ? 's' : ''} with {confidencePercentage}% confidence.
          </p>
        </div>

        {/* Map preview */}
        <div className="mb-6" style={{ height: '300px' }}>
          <InteractiveMap
            center={{ lat: suggestion.latitude, lng: suggestion.longitude }}
            zoom={15}
            markers={[{
              id: suggestion.id,
              latitude: suggestion.latitude,
              longitude: suggestion.longitude,
              name: suggestion.address || 'Location',
              color: colors.accent,
            }]}
            height="300px"
            style="dark"
          />
        </div>

        {/* Location details */}
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.secondary }}>
          <div className="space-y-2">
            <div>
              <label
                className="text-xs block mb-1"
                style={{ color: colors.text, opacity: 0.7 }}
              >
                Address
              </label>
              <p
                className="text-sm"
                style={{ color: colors.text }}
              >
                {suggestion.address || `${suggestion.latitude.toFixed(6)}, ${suggestion.longitude.toFixed(6)}`}
              </p>
            </div>
            
            <div>
              <label
                className="text-xs block mb-2"
                style={{ color: colors.text, opacity: 0.7 }}
              >
                Label
              </label>
              <LocationLabelInput
                value={customLabel}
                onChange={setCustomLabel}
                placeholder="Enter location label..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleDismiss}
            disabled={isProcessing}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{
              color: colors.text,
              opacity: isProcessing ? 0.5 : 0.7,
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.backgroundColor = colors.secondary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Dismiss
          </button>
          
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              opacity: isProcessing ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              }
            }}
          >
            Reject
          </button>
          
          <button
            onClick={handleAccept}
            disabled={isProcessing || !customLabel.trim()}
            className="px-4 py-2 text-sm rounded transition-colors font-medium"
            style={{
              backgroundColor: isProcessing || !customLabel.trim() ? colors.secondary : colors.accent,
              color: isProcessing || !customLabel.trim() ? colors.text : colors.primary,
              opacity: isProcessing || !customLabel.trim() ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isProcessing && customLabel.trim()) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing && customLabel.trim()) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {isProcessing ? 'Saving...' : 'Save Location'}
          </button>
        </div>
      </div>
    </div>
  );
}

