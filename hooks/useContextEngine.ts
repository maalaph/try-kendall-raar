/**
 * Context Engine Hook
 * Proactive location intelligence with map interaction
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ContextPlace {
  id: string;
  name: string;
  category?: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
}

export interface ContextEngineState {
  isLoading: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  nearbyPlaces: ContextPlace[];
  clusters: any[];
  error: string | null;
}

interface UseContextEngineOptions {
  userId?: string;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook for proactive location context engine
 * Fetches nearby places and clusters when map moves
 */
export function useContextEngine(options: UseContextEngineOptions = {}) {
  const { userId, debounceMs = 500, enabled = true } = options;
  
  const [state, setState] = useState<ContextEngineState>({
    isLoading: false,
    currentLocation: null,
    nearbyPlaces: [],
    clusters: [],
    error: null,
  });
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch nearby places for a given location
   */
  const fetchNearbyPlaces = useCallback(async (
    latitude: number,
    longitude: number,
    query?: string
  ) => {
    if (!enabled) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        query: query || 'restaurant cafe coffee',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        limit: '10',
      });
      
      if (userId) {
        params.set('userId', userId);
      }
      
      const response = await fetch(`/api/search?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch nearby places');
      }
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentLocation: { latitude, longitude },
        nearbyPlaces: data.results || [],
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch nearby places',
      }));
    }
  }, [enabled, userId]);

  /**
   * Handle map bounds change (debounced)
   */
  const onMapMoveEnd = useCallback((bounds: MapBounds, center: { lat: number; lng: number }) => {
    if (!enabled) return;
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchNearbyPlaces(center.lat, center.lng);
    }, debounceMs);
  }, [enabled, debounceMs, fetchNearbyPlaces]);

  /**
   * Fetch clusters for user
   */
  const fetchClusters = useCallback(async () => {
    if (!userId || !enabled) return;
    
    try {
      const response = await fetch(`/api/location/clusters?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          clusters: data.clusters || [],
        }));
      }
    } catch (error) {
      console.warn('[ContextEngine] Failed to fetch clusters:', error);
    }
  }, [userId, enabled]);

  /**
   * Update current location
   */
  const setCurrentLocation = useCallback((latitude: number, longitude: number) => {
    setState(prev => ({
      ...prev,
      currentLocation: { latitude, longitude },
    }));
  }, []);

  /**
   * Clear context
   */
  const clearContext = useCallback(() => {
    setState({
      isLoading: false,
      currentLocation: null,
      nearbyPlaces: [],
      clusters: [],
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch clusters on mount if userId provided
  useEffect(() => {
    if (userId && enabled) {
      fetchClusters();
    }
  }, [userId, enabled, fetchClusters]);

  return {
    ...state,
    onMapMoveEnd,
    fetchNearbyPlaces,
    fetchClusters,
    setCurrentLocation,
    clearContext,
  };
}

export default useContextEngine;



