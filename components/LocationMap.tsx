'use client';

/**
 * Location Map Component for Settings Page
 * Enhanced map with click-to-add, custom location markers, and user location
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { colors } from '@/lib/config';
import InteractiveMap, { MapMarker } from './InteractiveMap';

export interface SavedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface LocationMapProps {
  savedLocations: SavedLocation[];
  currentLocation?: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onLocationClick?: (location: SavedLocation) => void;
  height?: string;
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
}

export default function LocationMap({
  savedLocations,
  currentLocation,
  onMapClick,
  onLocationClick,
  height = '100%',
  className = '',
}: LocationMapProps) {
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.0060 }); // Default to NYC
  const [mapZoom, setMapZoom] = useState(12);

  // Calculate center from saved locations or use current location
  useEffect(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
      setMapZoom(14);
    } else if (savedLocations.length > 0) {
      // Calculate centroid of all saved locations
      const avgLat = savedLocations.reduce((sum, loc) => sum + loc.latitude, 0) / savedLocations.length;
      const avgLng = savedLocations.reduce((sum, loc) => sum + loc.longitude, 0) / savedLocations.length;
      setMapCenter({ lat: avgLat, lng: avgLng });
      setMapZoom(12);
    }
  }, [savedLocations, currentLocation]);

  // Convert saved locations to map markers
  const markers: MapMarker[] = savedLocations.map((location) => ({
    id: location.id,
    latitude: location.latitude,
    longitude: location.longitude,
    name: location.label,
    category: location.label,
    color: colors.accent,
  }));

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    const location = savedLocations.find(loc => loc.id === marker.id);
    if (location && onLocationClick) {
      onLocationClick(location);
    }
  }, [savedLocations, onLocationClick]);

  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        height, 
        position: 'relative',
        width: '100%',
        minHeight: height === '100%' ? '400px' : undefined,
      }}
    >
      <InteractiveMap
        center={mapCenter}
        zoom={mapZoom}
        markers={markers}
        onMarkerClick={handleMarkerClick}
        onMapClick={onMapClick}
        showUserLocation={!!currentLocation}
        userLocation={currentLocation}
        height={height}
        style="dark"
        className="rounded-lg"
      />
    </div>
  );
}

