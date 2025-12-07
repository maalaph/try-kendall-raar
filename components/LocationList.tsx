'use client';

/**
 * Location List Component
 * Displays list of saved locations with edit/delete actions
 */

import { useState } from 'react';
import { colors } from '@/lib/config';

export interface SavedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string;
  createdAt?: string;
}

interface LocationListProps {
  locations: SavedLocation[];
  onEdit?: (location: SavedLocation) => void;
  onDelete?: (locationId: string) => void;
  onSelect?: (location: SavedLocation) => void;
  className?: string;
}

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

function getIconForLabel(label: string): string {
  if (LABEL_ICONS[label]) {
    return LABEL_ICONS[label];
  }
  
  const lowerLabel = label.toLowerCase();
  for (const [key, icon] of Object.entries(LABEL_ICONS)) {
    if (lowerLabel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerLabel)) {
      return icon;
    }
  }
  
  return '📍';
}

export default function LocationList({
  locations,
  onEdit,
  onDelete,
  onSelect,
  className = '',
}: LocationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (location: SavedLocation) => {
    if (!onDelete) return;
    
    if (window.confirm(`Delete "${location.label}"?`)) {
      setDeletingId(location.id);
      try {
        await onDelete(location.id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (locations.length === 0) {
    return (
      <div
        className={`p-8 text-center ${className}`}
        style={{ color: colors.text, opacity: 0.6 }}
      >
        <p className="text-sm">No saved locations yet.</p>
        <p className="text-xs mt-2">Click on the map to add your first location.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {locations.map((location) => (
        <div
          key={location.id}
          className="p-3 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            backgroundColor: colors.secondary,
            border: `1px solid ${colors.secondary}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.backgroundColor = `${colors.accent}10`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.secondary;
            e.currentTarget.style.backgroundColor = colors.secondary;
          }}
          onClick={() => onSelect?.(location)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="text-2xl flex-shrink-0">
                {getIconForLabel(location.label)}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-medium text-sm truncate"
                  style={{ color: colors.text }}
                >
                  {location.label}
                </h3>
                {location.address && (
                  <p
                    className="text-xs mt-1 truncate"
                    style={{ color: colors.text, opacity: 0.7 }}
                  >
                    {location.address}
                  </p>
                )}
                {!location.address && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: colors.text, opacity: 0.5 }}
                  >
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(location);
                  }}
                  className="p-1.5 rounded transition-colors"
                  style={{
                    color: colors.text,
                    opacity: 0.7,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.7';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Edit location"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(location);
                  }}
                  disabled={deletingId === location.id}
                  className="p-1.5 rounded transition-colors"
                  style={{
                    color: '#ef4444',
                    opacity: deletingId === location.id ? 0.5 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    if (deletingId !== location.id) {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deletingId !== location.id) {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  title="Delete location"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

