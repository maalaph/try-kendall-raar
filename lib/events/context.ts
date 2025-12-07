/**
 * Multi-dimensional Context Builder
 * Builds context for event recommendations (mode, weather, sequence, behavioral)
 */

import { supabase } from '@/lib/supabase';
import { getUserPatterns } from '@/lib/database';
import { buildLocationContext } from '@/lib/location/clustering';

export interface RecommendationContext {
  userMode?: 'workday_evening' | 'travel_weekend' | 'weekend' | 'weekday' | 'holiday';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  weather?: {
    condition: string;
    temperature?: number;
    indoorBias?: boolean; // Prefer indoor events if bad weather
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isHome?: boolean;
    isWork?: boolean;
  };
  sequence?: {
    recentActions?: string[];
    declinedCategories?: string[];
    savedEventIds?: string[];
  };
  behavioral?: {
    currentMood?: string;
    preferredTimeRange?: string;
  };
}

/**
 * Build context for event recommendations
 */
export async function buildRecommendationContext(
  recordId: string,
  userLocation?: { latitude: number; longitude: number; formatted_address?: string },
  options: {
    includeWeather?: boolean;
    includeSequence?: boolean;
  } = {}
): Promise<RecommendationContext> {
  const context: RecommendationContext = {};

  // 1. Determine user mode from calendar/patterns
  context.userMode = await determineUserMode(recordId);

  // 2. Determine time of day
  context.timeOfDay = getTimeOfDay();

  // 3. Get location context
  if (userLocation) {
    context.location = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      address: userLocation.formatted_address,
    };

    // Check if location is home/work
    try {
      const locationContext = await buildLocationContext(recordId);
      if (locationContext) {
        // Parse location context to determine if current location is home/work
        // This is a simplified check - could be enhanced
        if (locationContext.includes('home')) {
          context.location.isHome = true;
        }
        if (locationContext.includes('work')) {
          context.location.isWork = true;
        }
      }
    } catch (error) {
      console.debug('[CONTEXT] Failed to get location context:', error);
    }
  }

  // 4. Get weather context (optional)
  if (options.includeWeather && userLocation) {
    try {
      context.weather = await getWeatherContext(userLocation.latitude, userLocation.longitude);
    } catch (error) {
      console.debug('[CONTEXT] Weather unavailable:', error);
    }
  }

  // 5. Get sequence context (recent actions)
  if (options.includeSequence) {
    context.sequence = await getSequenceContext(recordId);
  }

  // 6. Get behavioral context from patterns
  context.behavioral = await getBehavioralContext(recordId);

  return context;
}

/**
 * Determine user mode from patterns and calendar
 */
async function determineUserMode(recordId: string): Promise<RecommendationContext['userMode']> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();

  // Check if it's a weekend
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Check patterns for time preferences
  const patterns = await getUserPatterns(recordId);
  
  // Look for workday/weekend patterns
  const hasWorkdayPattern = patterns.some((p) =>
    p.patternData.description?.toLowerCase().includes('weekday') ||
    p.patternData.description?.toLowerCase().includes('workday')
  );

  const hasWeekendPattern = patterns.some((p) =>
    p.patternData.description?.toLowerCase().includes('weekend')
  );

  // Determine mode
  if (hasWeekendPattern && isWeekend) {
    return 'weekend';
  }

  if (hasWorkdayPattern && !isWeekend) {
    if (hour >= 17) {
      return 'workday_evening';
    }
    return 'weekday';
  }

  // Default based on day/time
  if (isWeekend) {
    return 'weekend';
  }

  if (hour >= 17) {
    return 'workday_evening';
  }

  return 'weekday';
}

/**
 * Get time of day
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Get weather context (simplified - requires weather API)
 */
async function getWeatherContext(
  latitude: number,
  longitude: number
): Promise<RecommendationContext['weather']> {
  // Placeholder - would integrate with weather API
  // For Phase 1, return null (optional feature)
  
  // Example integration with OpenWeatherMap or similar:
  // const apiKey = process.env.WEATHER_API_KEY;
  // if (!apiKey) return undefined;
  // ... fetch weather data ...
  
  return undefined;
}

/**
 * Get sequence context (recent user actions)
 */
async function getSequenceContext(recordId: string): Promise<RecommendationContext['sequence']> {
  try {
    // Get recent event impressions/interactions
    const { data: recentImpressions } = await supabase
      .from('event_impressions')
      .select('event_id, shown_at, context')
      .eq('record_id', recordId)
      .order('shown_at', { ascending: false })
      .limit(10);

    const { data: recentInteractions } = await supabase
      .from('event_interactions')
      .select('action, impression_id, timestamp')
      .eq('record_id', recordId)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Extract declined categories
    const declinedCategories = new Set<string>();
    const savedEventIds: string[] = [];

    // This would need to be joined with events table to get categories
    // For Phase 1, simplified version

    return {
      recentActions: recentInteractions?.map((i) => i.action) || [],
      declinedCategories: Array.from(declinedCategories),
      savedEventIds,
    };
  } catch (error) {
    console.debug('[CONTEXT] Failed to get sequence context:', error);
    return {};
  }
}

/**
 * Get behavioral context from patterns
 */
async function getBehavioralContext(recordId: string): Promise<RecommendationContext['behavioral']> {
  const patterns = await getUserPatterns(recordId);
  
  // Extract time preferences from patterns
  let preferredTimeRange: string | undefined;
  
  for (const pattern of patterns) {
    if (pattern.patternType === 'time_based_action' && pattern.patternData.timeOfDay) {
      preferredTimeRange = pattern.patternData.timeOfDay;
      break;
    }
  }

  return {
    preferredTimeRange,
  };
}

/**
 * Apply context boost to recommendation score
 */
export function applyContextBoost(
  baseScore: number,
  context: RecommendationContext,
  event: {
    category?: string | null;
    start_date: Date | string;
    latitude?: number | null;
    longitude?: number | null;
  }
): number {
  let boost = 0;

  // Time of day boost
  if (context.timeOfDay) {
    const eventDate = typeof event.start_date === 'string' 
      ? new Date(event.start_date) 
      : event.start_date;
    const eventHour = eventDate.getHours();
    
    if (context.timeOfDay === 'evening' && eventHour >= 17 && eventHour < 22) {
      boost += 0.1;
    }
    if (context.timeOfDay === 'afternoon' && eventHour >= 12 && eventHour < 17) {
      boost += 0.1;
    }
  }

  // Weather boost (prefer indoor if bad weather)
  if (context.weather?.indoorBias) {
    const indoorCategories = ['Arts', 'Education', 'Food & Drink', 'Technology'];
    if (event.category && indoorCategories.includes(event.category)) {
      boost += 0.15;
    }
  }

  // Weekend mode boost (prefer social/entertainment events)
  if (context.userMode === 'weekend') {
    const weekendCategories = ['Music', 'Entertainment', 'Food & Drink', 'Sports'];
    if (event.category && weekendCategories.includes(event.category)) {
      boost += 0.1;
    }
  }

  // Workday evening boost (prefer casual/short events)
  if (context.userMode === 'workday_evening') {
    const casualCategories = ['Food & Drink', 'Networking', 'Arts'];
    if (event.category && casualCategories.includes(event.category)) {
      boost += 0.1;
    }
  }

  // Location boost (prefer events near current location)
  if (context.location && event.latitude && event.longitude) {
    const distance = calculateDistance(
      context.location.latitude,
      context.location.longitude,
      event.latitude,
      event.longitude
    );
    
    // Boost for events within 5km
    if (distance < 5) {
      boost += 0.2;
    } else if (distance < 10) {
      boost += 0.1;
    }
  }

  return Math.min(1.0, baseScore + boost);
}

/**
 * Helper: Calculate distance between coordinates (km)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

