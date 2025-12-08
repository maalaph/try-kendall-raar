/**
 * Browser Geolocation Service
 * Frontend helper for interacting with browser's geolocation API
 * 
 * NOTE: This file is designed to be used in client components
 * Import with 'use client' directive
 */

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
  message: string;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Check if geolocation is supported by the browser
 */
export function isGeolocationSupported(): boolean {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Request permission and get current position
 */
export function getCurrentPosition(
  options: GeolocationOptions = {}
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject({
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by this browser',
      } as GeolocationError);
      return;
    }
    
    const geolocationOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 0,
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let errorCode: GeolocationError['code'];
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorCode = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            errorCode = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            errorCode = 'TIMEOUT';
            break;
          default:
            errorCode = 'POSITION_UNAVAILABLE';
        }
        
        reject({
          code: errorCode,
          message: error.message,
        } as GeolocationError);
      },
      geolocationOptions
    );
  });
}

/**
 * Watch position changes
 * Returns a cleanup function to stop watching
 */
export function watchPosition(
  onPosition: (position: GeolocationPosition) => void,
  onError: (error: GeolocationError) => void,
  options: GeolocationOptions = {}
): () => void {
  if (!isGeolocationSupported()) {
    onError({
      code: 'NOT_SUPPORTED',
      message: 'Geolocation is not supported by this browser',
    });
    return () => {};
  }
  
  const geolocationOptions: PositionOptions = {
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    timeout: options.timeout ?? 10000,
    maximumAge: options.maximumAge ?? 0,
  };
  
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onPosition({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude ?? undefined,
        altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      let errorCode: GeolocationError['code'];
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorCode = 'PERMISSION_DENIED';
          break;
        case error.POSITION_UNAVAILABLE:
          errorCode = 'POSITION_UNAVAILABLE';
          break;
        case error.TIMEOUT:
          errorCode = 'TIMEOUT';
          break;
        default:
          errorCode = 'POSITION_UNAVAILABLE';
      }
      
      onError({
        code: errorCode,
        message: error.message,
      });
    },
    geolocationOptions
  );
  
  // Return cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Request permission status (for modern browsers)
 */
export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (typeof window === 'undefined' || !navigator.permissions) {
    return 'unknown';
  }
  
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate distance between two coordinates (in meters)
 * Uses Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Check if a significant location change occurred
 * (More than threshold meters from previous position)
 */
export function isSignificantChange(
  prevLat: number,
  prevLon: number,
  newLat: number,
  newLon: number,
  thresholdMeters: number = 100
): boolean {
  const distance = calculateDistance(prevLat, prevLon, newLat, newLon);
  return distance >= thresholdMeters;
}

/**
 * Save location to backend API
 */
export async function saveLocationToBackend(
  userId: string,
  position: GeolocationPosition,
  label?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        altitudeAccuracy: position.altitudeAccuracy,
        heading: position.heading,
        speed: position.speed,
        label,
        source: 'browser',
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Failed to save location' };
    }
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get user's location history from backend
 */
export async function getLocationHistory(
  userId: string,
  limit?: number
): Promise<{ locations: any[]; error?: string }> {
  try {
    const params = new URLSearchParams({ userId });
    if (limit) {
      params.append('limit', String(limit));
    }
    
    const response = await fetch(`/api/location?${params}`);
    
    if (!response.ok) {
      const error = await response.json();
      return { locations: [], error: error.message || 'Failed to fetch locations' };
    }
    
    const data = await response.json();
    return { locations: data.locations || [] };
  } catch (error) {
    return {
      locations: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}



