/**
 * Event Recommendation Engine
 * Core scoring function R(user, event, context) for event recommendations
 */

import { Event, getEvents } from './dataLayer';
import { getUserInterests } from './interests';
import { buildRecommendationContext, applyContextBoost, RecommendationContext } from './context';
import { supabase } from '@/lib/supabase';

export interface ScoredEvent extends Event {
  score: number;
  scoreBreakdown?: {
    semantic?: number;
    location?: number;
    timing?: number;
    popularity?: number;
    novelty?: number;
    contextBoost?: number;
  };
  explanation?: string;
}

export interface RecommendationOptions {
  recordId: string;
  userLocation?: { latitude: number; longitude: number; formatted_address?: string };
  timeWindow?: {
    startDate?: Date;
    endDate?: Date;
  };
  maxDistance?: number; // in km
  categories?: string[];
  limit?: number;
  includeExplanations?: boolean;
}

/**
 * Recommend events for a user
 */
export async function recommendEvents(options: RecommendationOptions): Promise<ScoredEvent[]> {
  const {
    recordId,
    userLocation,
    timeWindow,
    maxDistance = 50,
    categories,
    limit = 10,
    includeExplanations = false,
  } = options;

  try {
    // 1. Get user interests
    const userInterests = await getUserInterests(recordId);

    // 2. Build context
    const context = await buildRecommendationContext(recordId, userLocation, {
      includeWeather: false, // Phase 1: skip weather
      includeSequence: false, // Phase 1: skip sequence
    });

    // 3. Fetch candidate events
    const startDate = timeWindow?.startDate || new Date();
    const endDate = timeWindow?.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: next 7 days

    const candidateEvents = await getEvents({
      startDate,
      endDate,
      category: categories?.[0], // Simple: use first category if provided
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
      radiusKm: maxDistance,
      limit: limit * 3, // Fetch more candidates for scoring
    });

    // 4. Score each event
    const scoredEvents: ScoredEvent[] = [];

    for (const event of candidateEvents) {
      const score = await scoreEvent(event, userInterests, context, recordId, userLocation);
      
      if (score.totalScore > 0) {
        scoredEvents.push({
          ...event,
          score: score.totalScore,
          scoreBreakdown: score.breakdown,
          explanation: includeExplanations ? generateExplanation(event, score, context) : undefined,
        });
      }
    }

    // 5. Sort by score and return top results
    scoredEvents.sort((a, b) => b.score - a.score);
    return scoredEvents.slice(0, limit);
  } catch (error) {
    console.error('[RECOMMENDER] Failed to recommend events:', error);
    throw error;
  }
}

/**
 * Score a single event: R(user, event, context)
 */
async function scoreEvent(
  event: Event,
  userInterests: { interest_embedding?: number[] | null; interest_tags?: string[] } | null,
  context: RecommendationContext,
  recordId: string,
  userLocation?: { latitude: number; longitude: number }
): Promise<{
  totalScore: number;
  breakdown: {
    semantic?: number;
    location?: number;
    timing?: number;
    popularity?: number;
    novelty?: number;
    contextBoost?: number;
  };
}> {
  // Initialize weights (will be learned from feedback later)
  const weights = {
    semantic: 0.4,
    location: 0.2,
    timing: 0.15,
    popularity: 0.1,
    novelty: 0.1,
    contextBoost: 0.05,
  };

  const breakdown: any = {};

  // 1. Semantic similarity score
  breakdown.semantic = await calculateSemanticScore(event, userInterests);

  // 2. Location score
  breakdown.location = calculateLocationScore(event, userLocation);

  // 3. Timing score
  breakdown.timing = calculateTimingScore(event, context);

  // 4. Popularity score
  breakdown.popularity = await calculatePopularityScore(event);

  // 5. Novelty score
  breakdown.novelty = await calculateNoveltyScore(event, recordId);

  // 6. Context boost
  const baseScore =
    weights.semantic * (breakdown.semantic || 0) +
    weights.location * (breakdown.location || 0) +
    weights.timing * (breakdown.timing || 0) +
    weights.popularity * (breakdown.popularity || 0) +
    weights.novelty * (breakdown.novelty || 0);

  breakdown.contextBoost = applyContextBoost(baseScore, context, event) - baseScore;

  // Calculate total score
  const totalScore =
    weights.semantic * (breakdown.semantic || 0) +
    weights.location * (breakdown.location || 0) +
    weights.timing * (breakdown.timing || 0) +
    weights.popularity * (breakdown.popularity || 0) +
    weights.novelty * (breakdown.novelty || 0) +
    breakdown.contextBoost;

  return {
    totalScore: Math.max(0, Math.min(1, totalScore)), // Clamp between 0 and 1
    breakdown,
  };
}

/**
 * Calculate semantic similarity score between user interests and event
 */
async function calculateSemanticScore(
  event: Event,
  userInterests: { interest_embedding?: number[] | null; interest_tags?: string[] } | null
): Promise<number> {
  if (!userInterests?.interest_embedding || !event.embedding) {
    // Fallback to tag-based matching
    if (userInterests?.interest_tags && event.category) {
      const categoryLower = event.category.toLowerCase();
      const hasMatchingTag = userInterests.interest_tags.some((tag) =>
        categoryLower.includes(tag.toLowerCase())
      );
      return hasMatchingTag ? 0.6 : 0.3;
    }
    return 0.5; // Neutral score if no embedding data
  }

  // Calculate cosine similarity
  const similarity = cosineSimilarity(userInterests.interest_embedding, event.embedding);
  return Math.max(0, similarity); // Ensure non-negative
}

/**
 * Calculate location score (distance-based)
 */
function calculateLocationScore(
  event: Event,
  userLocation?: { latitude: number; longitude: number }
): number {
  if (!userLocation || !event.latitude || !event.longitude) {
    return 0.5; // Neutral if no location data
  }

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    event.latitude,
    event.longitude
  );

  // Distance decay function: closer = higher score
  // Score drops to 0.5 at ~10km, 0.2 at ~25km, 0 at ~50km
  if (distance < 1) return 1.0;
  if (distance < 5) return 0.9;
  if (distance < 10) return 0.7;
  if (distance < 25) return 0.5 - (distance - 10) / 30; // Linear decay
  return Math.max(0, 0.2 - (distance - 25) / 125);
}

/**
 * Calculate timing score (based on user's schedule preferences)
 */
function calculateTimingScore(event: Event, context: RecommendationContext): number {
  const eventDate = typeof event.start_date === 'string' ? new Date(event.start_date) : event.start_date;
  const eventHour = eventDate.getHours();
  const eventDay = eventDate.getDay();

  let score = 0.5; // Base score

  // Check if event time matches user's preferred time
  if (context.behavioral?.preferredTimeRange) {
    const preferredHour = parseInt(context.behavioral.preferredTimeRange.split(':')[0] || '18');
    const hourDiff = Math.abs(eventHour - preferredHour);
    score += (1 - hourDiff / 6) * 0.3; // Boost if within 6 hours
  }

  // Boost for weekend events on weekends
  if (context.userMode === 'weekend' && (eventDay === 0 || eventDay === 6)) {
    score += 0.2;
  }

  // Boost for evening events on workday evenings
  if (context.userMode === 'workday_evening' && eventHour >= 17 && eventHour < 22) {
    score += 0.2;
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Calculate popularity score (from metadata or interactions)
 */
async function calculatePopularityScore(event: Event): Promise<number> {
  try {
    if (!event.id) return 0.5;

    // Count impressions/interactions for this event
    const { data: impressions } = await supabase
      .from('event_impressions')
      .select('id')
      .eq('event_id', event.id)
      .limit(100);

    const impressionCount = impressions?.length || 0;

    if (impressionCount === 0) {
      return 0.5; // Neutral score if no impressions yet
    }

    // Get interactions for these impressions
    const impressionIds = (impressions || []).map((i) => i.id);
    if (impressionIds.length === 0) {
      return 0.5;
    }

    const { data: interactions } = await supabase
      .from('event_interactions')
      .select('id')
      .in('impression_id', impressionIds)
      .eq('action', 'click')
      .limit(100);

    const clickCount = interactions?.length || 0;

    // Simple popularity: click-through rate
    const ctr = clickCount / impressionCount;
    return Math.min(1, ctr * 2); // Normalize: 0.5 CTR = 1.0 score
  } catch (error) {
    console.debug('[RECOMMENDER] Popularity score calculation error:', error);
    return 0.5; // Default on error
  }
}

/**
 * Calculate novelty score (exploration vs exploitation)
 */
async function calculateNoveltyScore(event: Event, recordId: string): Promise<number> {
  try {
    // Check if user has seen/interacted with similar events
    const { data: similarImpressions } = await supabase
      .from('event_impressions')
      .select('event_id')
      .eq('record_id', recordId)
      .limit(100);

    if (!similarImpressions || similarImpressions.length === 0) {
      return 1.0; // High novelty if no history
    }

    // Check if this exact event was shown before
    const wasShown = similarImpressions.some((imp) => imp.event_id === event.id);
    if (wasShown) {
      return 0.3; // Lower novelty if already shown
    }

    // Check category frequency
    if (event.category) {
      // In Phase 1, simple check - could be enhanced with category frequency analysis
      return 0.7; // Moderate novelty
    }

    return 0.8; // High novelty for new categories
  } catch (error) {
    return 0.5; // Default on error
  }
}

/**
 * Generate explanation for recommendation
 */
function generateExplanation(
  event: Event,
  score: { breakdown: any },
  context: RecommendationContext
): string {
  const reasons: string[] = [];

  if (score.breakdown.semantic && score.breakdown.semantic > 0.7) {
    reasons.push('matches your interests');
  }

  if (score.breakdown.location && score.breakdown.location > 0.7) {
    reasons.push('close to your location');
  }

  if (score.breakdown.timing && score.breakdown.timing > 0.7) {
    reasons.push('fits your schedule preferences');
  }

  if (context.userMode === 'weekend') {
    reasons.push('perfect for your weekend');
  }

  if (reasons.length === 0) {
    return 'This event might interest you.';
  }

  return `Recommended because it ${reasons.join(', ')}.`;
}

/**
 * Helper: Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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

