/**
 * User Interest Modeling
 * Builds user interest embeddings from memories, patterns, Spotify, and behavior
 */

import { supabase } from '@/lib/supabase';
import { getUserMemories, getUserPatterns, UserMemory, UserPattern } from '@/lib/database';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface UserInterests {
  record_id: string;
  interest_embedding?: number[] | null;
  interest_tags?: string[];
  confidence_scores?: Record<string, number>;
  last_updated: Date;
}

/**
 * Get or build user interest profile
 */
export async function getUserInterests(recordId: string): Promise<UserInterests | null> {
  try {
    const { data, error } = await supabase
      .from('user_interests')
      .select('*')
      .eq('record_id', recordId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      // Build initial interest profile
      return await buildUserInterests(recordId);
    }

    return {
      record_id: data.record_id,
      interest_embedding: data.interest_embedding ? JSON.parse(data.interest_embedding) : null,
      interest_tags: data.interest_tags || [],
      confidence_scores: data.confidence_scores || {},
      last_updated: new Date(data.last_updated),
    };
  } catch (error) {
    console.error('[INTERESTS] Failed to get user interests:', error);
    return null;
  }
}

/**
 * Build or rebuild user interest profile from all sources
 */
export async function buildUserInterests(recordId: string): Promise<UserInterests> {
  try {
    // Collect interest signals from multiple sources
    const interestTexts: Array<{ text: string; weight: number }> = [];

    // 1. Extract from memories (preferences, facts)
    const memories = await getUserMemories(recordId, 'preference');
    for (const memory of memories) {
      if (memory.value) {
        const weight = memory.importance === 'high' ? 1.0 : memory.importance === 'medium' ? 0.7 : 0.5;
        interestTexts.push({ text: memory.value, weight });
      }
    }

    // 2. Extract from patterns (behavioral preferences)
    const patterns = await getUserPatterns(recordId);
    for (const pattern of patterns) {
      if (pattern.patternData.description) {
        const weight = (pattern.confidence || 0.5) * 0.8; // Patterns are slightly less weighted
        interestTexts.push({ text: pattern.patternData.description, weight });
      }
    }

    // 3. Extract from Spotify (if connected) - map music taste to event preferences
    try {
      const spotifyInterests = await getSpotifyBasedInterests(recordId);
      if (spotifyInterests) {
        interestTexts.push({ text: spotifyInterests, weight: 0.6 });
      }
    } catch (error) {
      // Spotify not connected or error - skip
      console.debug('[INTERESTS] Spotify interests unavailable:', error);
    }

    // 4. Extract from location patterns (venue preferences)
    try {
      const locationInterests = await getLocationBasedInterests(recordId);
      if (locationInterests) {
        interestTexts.push({ text: locationInterests, weight: 0.5 });
      }
    } catch (error) {
      console.debug('[INTERESTS] Location interests unavailable:', error);
    }

    // Combine all interest texts
    const combinedText = interestTexts
      .map((item) => item.text)
      .filter(Boolean)
      .join(' ');

    if (!combinedText.trim()) {
      // No interests found - create default neutral profile
      return await createDefaultInterests(recordId);
    }

    // Generate embedding for combined interests
    const embedding = await generateInterestEmbedding(combinedText);

    // Extract interest tags
    const tags = extractInterestTags(interestTexts);
    const confidenceScores = calculateConfidenceScores(interestTexts);

    // Save to database
    const interests: UserInterests = {
      record_id: recordId,
      interest_embedding: embedding,
      interest_tags: tags,
      confidence_scores: confidenceScores,
      last_updated: new Date(),
    };

    await saveUserInterests(interests);

    return interests;
  } catch (error) {
    console.error('[INTERESTS] Failed to build user interests:', error);
    return await createDefaultInterests(recordId);
  }
}

/**
 * Update user interests based on attended events
 */
export async function updateInterestsFromEvent(
  recordId: string,
  eventTitle: string,
  eventDescription?: string,
  eventCategory?: string
): Promise<void> {
  try {
    const currentInterests = await getUserInterests(recordId);
    if (!currentInterests) return;

    // Add event information to interest profile
    const eventText = [eventTitle, eventDescription, eventCategory].filter(Boolean).join(' ');

    // Combine with existing interests
    const combinedText = [
      ...(currentInterests.interest_tags || []).join(' '),
      eventText,
    ].join(' ');

    // Regenerate embedding
    const newEmbedding = await generateInterestEmbedding(combinedText);

    // Update tags and confidence
    const newTags = extractInterestTags([
      ...(currentInterests.interest_tags || []).map((tag) => ({ text: tag, weight: 0.8 })),
      { text: eventText, weight: 0.7 },
    ]);

    // Save updated interests
    currentInterests.interest_embedding = newEmbedding;
    currentInterests.interest_tags = newTags;
    currentInterests.last_updated = new Date();

    await saveUserInterests(currentInterests);
  } catch (error) {
    console.error('[INTERESTS] Failed to update from event:', error);
  }
}

/**
 * Generate embedding for interest text
 */
async function generateInterestEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!text.trim()) return null;

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[INTERESTS] Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Extract interest tags from texts
 */
function extractInterestTags(texts: Array<{ text: string; weight: number }>): string[] {
  const tags = new Set<string>();

  // Simple keyword extraction - in future, could use NLP
  const keywords = [
    'music', 'concert', 'jazz', 'rock', 'electronic', 'indie',
    'art', 'gallery', 'museum', 'exhibition',
    'sports', 'fitness', 'gym', 'running',
    'food', 'dining', 'restaurant', 'wine', 'beer',
    'tech', 'technology', 'startup', 'networking',
    'comedy', 'theater', 'theatre', 'entertainment',
    'workshop', 'class', 'education', 'learning',
  ];

  const combinedText = texts.map((t) => t.text.toLowerCase()).join(' ');

  for (const keyword of keywords) {
    if (combinedText.includes(keyword)) {
      tags.add(keyword);
    }
  }

  // Also extract event-type patterns
  if (combinedText.includes('concert') || combinedText.includes('music')) tags.add('music_events');
  if (combinedText.includes('workshop') || combinedText.includes('class')) tags.add('educational');
  if (combinedText.includes('networking') || combinedText.includes('meetup')) tags.add('social');
  if (combinedText.includes('sports') || combinedText.includes('fitness')) tags.add('active');

  return Array.from(tags);
}

/**
 * Calculate confidence scores for interest tags
 */
function calculateConfidenceScores(texts: Array<{ text: string; weight: number }>): Record<string, number> {
  const scores: Record<string, number> = {};
  const combinedText = texts.map((t) => t.text.toLowerCase()).join(' ');

  const keywords = [
    'music', 'art', 'sports', 'food', 'tech', 'comedy', 'workshop',
  ];

  for (const keyword of keywords) {
    const occurrences = (combinedText.match(new RegExp(keyword, 'gi')) || []).length;
    if (occurrences > 0) {
      // Average weight of texts containing this keyword
      const relevantTexts = texts.filter((t) => t.text.toLowerCase().includes(keyword));
      const avgWeight = relevantTexts.reduce((sum, t) => sum + t.weight, 0) / relevantTexts.length;
      scores[keyword] = Math.min(1.0, avgWeight * (occurrences / 5)); // Normalize
    }
  }

  return scores;
}

/**
 * Get Spotify-based interests
 */
async function getSpotifyBasedInterests(recordId: string): Promise<string | null> {
  try {
    // Check if user has Spotify connected
    const { data: user } = await supabase
      .from('users')
      .select('spotify_access_token')
      .eq('record_id', recordId)
      .single();

    if (!user?.spotify_access_token) {
      return null;
    }

    // Fetch Spotify top artists (simplified - would need full Spotify API integration)
    // For now, return null - can be extended later
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get location-based interests
 */
async function getLocationBasedInterests(recordId: string): Promise<string | null> {
  try {
    // Get saved locations (home, work, etc.)
    const { data: locations } = await supabase
      .from('saved_locations')
      .select('label, address')
      .eq('user_id', recordId)
      .limit(5);

    if (!locations || locations.length === 0) {
      return null;
    }

    // Extract venue/area preferences from location labels
    const labels = locations.map((l) => l.label).join(' ');
    return `Frequents: ${labels}`;
  } catch (error) {
    return null;
  }
}

/**
 * Create default neutral interest profile
 */
async function createDefaultInterests(recordId: string): Promise<UserInterests> {
  const interests: UserInterests = {
    record_id: recordId,
    interest_embedding: null,
    interest_tags: [],
    confidence_scores: {},
    last_updated: new Date(),
  };

  await saveUserInterests(interests);
  return interests;
}

/**
 * Save user interests to database
 */
async function saveUserInterests(interests: UserInterests): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_interests')
      .upsert(
        {
          record_id: interests.record_id,
          interest_embedding: interests.interest_embedding
            ? JSON.stringify(interests.interest_embedding)
            : null,
          interest_tags: interests.interest_tags || [],
          confidence_scores: interests.confidence_scores || {},
          last_updated: interests.last_updated.toISOString(),
        },
        { onConflict: 'record_id' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('[INTERESTS] Failed to save user interests:', error);
    throw error;
  }
}

