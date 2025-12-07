'use client';

/**
 * Interactive Map Component
 * Uses Mapbox GL JS v3 with Standard style
 * Renders in chat stream with generative UI
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { colors } from '@/lib/config';

// Mapbox GL JS types
declare global {
  interface Window {
    mapboxgl: any;
  }
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  category?: string;
  color?: string;
}

export interface InteractiveMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showUserLocation?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  height?: string;
  className?: string;
  style?: 'standard' | 'streets' | 'dark';
}

export default function InteractiveMap({
  center,
  zoom = 14,
  markers = [],
  onMarkerClick,
  onMapClick,
  showUserLocation = false,
  userLocation,
  height = '300px',
  className = '',
  style = 'standard',
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get Mapbox style URL based on style prop and time of day
  const getStyleUrl = useCallback(() => {
    if (style === 'dark') {
      return 'mapbox://styles/mapbox/dark-v11';
    }
    if (style === 'streets') {
      return 'mapbox://styles/mapbox/streets-v12';
    }
    // Standard style with time-based lighting
    return 'mapbox://styles/mapbox/standard';
  }, [style]);

  // Initialize map
  useEffect(() => {
    // Prevent double initialization (React StrictMode)
    if (!mapContainerRef.current || mapRef.current) return;

    const initMap = async () => {
      try {
        const container = mapContainerRef.current!;
        
        if (!container) {
          console.error('[InteractiveMap] Container ref is null');
          return;
        }
        
        // CRITICAL: Container MUST be completely empty before Mapbox initialization
        // Remove any child nodes, text content, or innerHTML
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        container.textContent = '';
        container.innerHTML = '';
        
        // Small delay to ensure DOM is clean (Mapbox requirement)
        await new Promise(resolve => setTimeout(resolve, 50));

        // Dynamically import mapbox-gl to avoid SSR issues
        const mapboxgl = (await import('mapbox-gl')).default;
        
        // Set access token
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token || token === 'your_mapbox_public_token') {
          setError('Mapbox token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.');
          console.error('[InteractiveMap] NEXT_PUBLIC_MAPBOX_TOKEN is missing or not set');
          return;
        }
        mapboxgl.accessToken = token;

        // Final check - container MUST be empty right before Map() constructor
        // Only clear if it's NOT Mapbox elements (Mapbox elements start with 'mapboxgl-')
        const hasMapboxElements = container.children.length > 0 && Array.from(container.children).some((child: any) => 
          child.className && typeof child.className === 'string' && child.className.includes('mapboxgl-')
        );
        
        if (!hasMapboxElements && (container.children.length > 0 || (container.textContent && container.textContent.trim()))) {
          // Clear non-Mapbox content
          container.innerHTML = '';
          container.textContent = '';
        }

        // Ensure container has proper dimensions for Mapbox
        if (!container.offsetWidth || !container.offsetHeight) {
          console.warn('[InteractiveMap] Container has no dimensions:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            computed: window.getComputedStyle(container)
          });
        }

        // Create map - container is now guaranteed empty
        // Mapbox will populate this container with canvas and controls
        const map = new mapboxgl.Map({
          container: container,
          style: getStyleUrl(),
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
        });
        
        console.log('[InteractiveMap] Map instance created, container dimensions:', {
          width: container.offsetWidth,
          height: container.offsetHeight,
          children: container.children.length
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

        // Handle map load
        map.on('load', () => {
          setIsLoaded(true);
          
          // Set time-based lighting for Standard style
          if (style === 'standard' && map.setConfigProperty) {
            const hour = new Date().getHours();
            let lightPreset = 'day';
            if (hour >= 6 && hour < 8) lightPreset = 'dawn';
            else if (hour >= 18 && hour < 20) lightPreset = 'dusk';
            else if (hour >= 20 || hour < 6) lightPreset = 'night';
            
            try {
              map.setConfigProperty('basemap', 'lightPreset', lightPreset);
            } catch (e) {
              // Standard style config might not be available
            }
          }
        });

        // Handle map click
        map.on('click', (e: any) => {
          if (onMapClick) {
            onMapClick(e.lngLat.lat, e.lngLat.lng);
          }
        });

        mapRef.current = map;
        window.mapboxgl = mapboxgl;
      } catch (err) {
        console.error('[InteractiveMap] Error initializing map:', err);
        setError('Failed to load map');
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update center when prop changes
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.flyTo({
        center: [center.lng, center.lat],
        zoom,
        duration: 1000,
      });
    }
  }, [center.lat, center.lng, zoom, isLoaded]);

  // Update markers when they change
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !window.mapboxgl) return;

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    markers.forEach(markerData => {
      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${markerData.color || colors.accent};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: transform 0.2s;
      `;
      
      // Add icon based on category
      const icon = getCategoryIcon(markerData.category);
      el.innerHTML = icon;
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      const marker = new window.mapboxgl.Marker({ element: el })
        .setLngLat([markerData.longitude, markerData.latitude])
        .addTo(mapRef.current);

      // Add popup
      const popup = new window.mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding: 8px; font-family: system-ui, sans-serif;">
            <strong style="font-size: 14px;">${markerData.name}</strong>
            ${markerData.category ? `<br><span style="font-size: 12px; color: #666;">${markerData.category}</span>` : ''}
          </div>
        `);
      
      marker.setPopup(popup);

      // Handle click
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onMarkerClick) {
          onMarkerClick(markerData);
        }
      });

      markersRef.current.push(marker);
    });
  }, [markers, isLoaded, onMarkerClick]);

  // Show user location marker
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !showUserLocation || !userLocation || !window.mapboxgl) return;

    const el = document.createElement('div');
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: #4285F4;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 8px rgba(66, 133, 244, 0.2), 0 2px 4px rgba(0,0,0,0.2);
    `;

    const marker = new window.mapboxgl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current);

    return () => {
      marker.remove();
    };
  }, [userLocation, showUserLocation, isLoaded]);

  if (error) {
    return (
      <div 
        className={`rounded-xl overflow-hidden ${className}`}
        style={{ 
          height, 
          background: `linear-gradient(135deg, ${colors.primary}80, ${colors.secondary})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.text,
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div className="text-4xl mb-4">🗺️</div>
        <div className="text-lg font-medium mb-2" style={{ color: colors.text, opacity: 0.9 }}>
          Map Not Available
        </div>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.7 }}>
          {error}
        </div>
        <div className="text-xs mt-4" style={{ color: colors.text, opacity: 0.5 }}>
          Get your Mapbox token from: <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>mapbox.com/access-tokens</a>
        </div>
      </div>
    );
  }

  // Parse height to ensure we have a valid value
  const containerHeight = height === '100%' ? '100%' : height || '400px';
  
  return (
    <div 
      className={`relative rounded-xl overflow-hidden ${className}`} 
      style={{ 
        height: containerHeight,
        position: 'relative', 
        width: '100%',
        minHeight: typeof containerHeight === 'string' && containerHeight.includes('%') ? '400px' : containerHeight,
      }}
    >
      {/* Map container - MUST be completely empty for Mapbox to work */}
      {/* No children, no text, no innerHTML - Mapbox will populate this */}
      <div 
        ref={mapContainerRef} 
        style={{ 
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      
      {/* Loading skeleton - positioned as overlay, NOT inside container */}
      {!isLoaded && !error && (
        <div 
          className="absolute inset-0 animate-pulse pointer-events-none"
          style={{ 
            background: `linear-gradient(135deg, ${colors.primary}80, ${colors.secondary})`,
            zIndex: 10,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2" style={{ color: colors.text, opacity: 0.6 }}>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading map...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Mapbox attribution - only show when map is loaded */}
      {isLoaded && !error && (
        <div 
          className="absolute bottom-1 left-1 text-xs px-1 rounded pointer-events-none"
          style={{ 
            background: 'rgba(255,255,255,0.8)', 
            color: '#333',
            fontSize: '10px',
            zIndex: 20,
            position: 'absolute',
          }}
        >
          © Mapbox
        </div>
      )}
    </div>
  );
}

// Helper function to get category icon
function getCategoryIcon(category?: string): string {
  if (!category) return '📍';
  
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('restaurant') || categoryLower.includes('food')) return '🍽️';
  if (categoryLower.includes('coffee') || categoryLower.includes('cafe')) return '☕';
  if (categoryLower.includes('bar') || categoryLower.includes('pub')) return '🍺';
  if (categoryLower.includes('hotel') || categoryLower.includes('lodging')) return '🏨';
  if (categoryLower.includes('shop') || categoryLower.includes('store')) return '🛍️';
  if (categoryLower.includes('gym') || categoryLower.includes('fitness')) return '💪';
  if (categoryLower.includes('park')) return '🌳';
  if (categoryLower.includes('hospital') || categoryLower.includes('medical')) return '🏥';
  if (categoryLower.includes('gas') || categoryLower.includes('fuel')) return '⛽';
  if (categoryLower.includes('bank') || categoryLower.includes('atm')) return '🏦';
  if (categoryLower.includes('school') || categoryLower.includes('university')) return '🎓';
  if (categoryLower.includes('airport')) return '✈️';
  if (categoryLower.includes('home')) return '🏠';
  if (categoryLower.includes('work') || categoryLower.includes('office')) return '🏢';
  
  return '📍';
}

