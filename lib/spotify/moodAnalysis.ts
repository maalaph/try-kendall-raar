/**
 * Mood Analysis Engine
 * Analyzes listening patterns to infer user moods and preferences
 */

import { getRecentlyPlayed, getAudioFeatures, SpotifyTrack, SpotifyAudioFeatures } from './client';
import { getUserRecord, updateUserRecord } from '@/lib/airtable';

export interface MoodPattern {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  energy: number; // 0-1
  valence: number; // 0-1 (happiness)
  tempo: number; // BPM
  genres: string[];
}

export interface InferredMood {
  mood: 'energetic' | 'relaxed' | 'happy' | 'contemplative' | 'focused' | 'mixed';
  confidence: number; // 0-1
  reasoning: string;
}

/**
 * Analyze audio features to infer mood
 */
function inferMoodFromFeatures(features: SpotifyAudioFeatures): InferredMood {
  const { energy, valence, tempo } = features;
  
  // High energy + fast tempo = energetic
  if (energy > 0.7 && tempo > 120) {
    return {
      mood: 'energetic',
      confidence: energy * 0.8,
      reasoning: 'High energy and fast tempo suggest an energetic, active mood',
    };
  }
  
  // Low energy + slow tempo = relaxed
  if (energy < 0.4 && tempo < 100) {
    return {
      mood: 'relaxed',
      confidence: (1 - energy) * 0.8,
      reasoning: 'Low energy and slow tempo suggest a relaxed, calm mood',
    };
  }
  
  // High valence = happy
  if (valence > 0.7) {
    return {
      mood: 'happy',
      confidence: valence * 0.8,
      reasoning: 'High valence (musical positivity) suggests a happy, upbeat mood',
    };
  }
  
  // Low valence = contemplative
  if (valence < 0.3) {
    return {
      mood: 'contemplative',
      confidence: (1 - valence) * 0.8,
      reasoning: 'Low valence suggests a contemplative, introspective mood',
    };
  }
  
  // Medium energy + medium tempo = focused
  if (energy >= 0.4 && energy <= 0.7 && tempo >= 100 && tempo <= 120) {
    return {
      mood: 'focused',
      confidence: 0.6,
      reasoning: 'Moderate energy and tempo suggest a focused, productive mood',
    };
  }
  
  // Default to mixed
  return {
    mood: 'mixed',
    confidence: 0.5,
    reasoning: 'Listening patterns show a mix of moods',
  };
}

/**
 * Get time of day category
 */
function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Analyze listening patterns by time of day
 */
export async function analyzeTimeBasedPatterns(
  recordId: string
): Promise<Record<'morning' | 'afternoon' | 'evening' | 'night', MoodPattern>> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 50);
  
  const patterns: Record<string, {
    energy: number[];
    valence: number[];
    tempo: number[];
    genres: Set<string>;
    count: number;
  }> = {
    morning: { energy: [], valence: [], tempo: [], genres: new Set(), count: 0 },
    afternoon: { energy: [], valence: [], tempo: [], genres: new Set(), count: 0 },
    evening: { energy: [], valence: [], tempo: [], genres: new Set(), count: 0 },
    night: { energy: [], valence: [], tempo: [], genres: new Set(), count: 0 },
  };
  
  // Get track IDs
  const trackIds = recentlyPlayed.items.map(item => item.track.id).slice(0, 50);
  
  // Get audio features for all tracks
  let audioFeatures: SpotifyAudioFeatures[] = [];
  try {
    const featuresResponse = await getAudioFeatures(recordId, trackIds);
    audioFeatures = featuresResponse.audio_features.filter((f): f is SpotifyAudioFeatures => f !== null);
  } catch (error) {
    console.error('[MOOD ANALYSIS] Failed to get audio features:', error);
    // Continue without features
  }
  
  // Group by time of day
  for (let i = 0; i < recentlyPlayed.items.length && i < audioFeatures.length; i++) {
    const item = recentlyPlayed.items[i];
    const features = audioFeatures[i];
    
    if (!features) continue;
    
    const playedAt = new Date(item.played_at);
    const timeOfDay = getTimeOfDay(playedAt.getHours());
    const pattern = patterns[timeOfDay];
    
    pattern.energy.push(features.energy);
    pattern.valence.push(features.valence);
    pattern.tempo.push(features.tempo);
    pattern.count++;
    
    // Extract genres from track (if available)
    if (item.track.album) {
      // Note: Spotify doesn't provide genres on tracks, would need artist lookup
      // For now, we'll skip genre extraction
    }
  }
  
  // Calculate averages
  const result: Record<string, MoodPattern> = {};
  for (const [timeOfDay, pattern] of Object.entries(patterns)) {
    if (pattern.count === 0) {
      result[timeOfDay] = {
        timeOfDay: timeOfDay as any,
        energy: 0.5,
        valence: 0.5,
        tempo: 100,
        genres: [],
      };
      continue;
    }
    
    result[timeOfDay] = {
      timeOfDay: timeOfDay as any,
      energy: pattern.energy.reduce((a, b) => a + b, 0) / pattern.energy.length,
      valence: pattern.valence.reduce((a, b) => a + b, 0) / pattern.valence.length,
      tempo: pattern.tempo.reduce((a, b) => a + b, 0) / pattern.tempo.length,
      genres: Array.from(pattern.genres),
    };
  }
  
  return result as Record<'morning' | 'afternoon' | 'evening' | 'night', MoodPattern>;
}

/**
 * Infer current mood from recent listening
 */
export async function inferCurrentMood(recordId: string): Promise<InferredMood> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 10);
  
  if (recentlyPlayed.items.length === 0) {
    return {
      mood: 'mixed',
      confidence: 0,
      reasoning: 'Not enough listening history to infer mood',
    };
  }
  
  // Get audio features for recent tracks
  const trackIds = recentlyPlayed.items.slice(0, 10).map(item => item.track.id);
  
  try {
    const featuresResponse = await getAudioFeatures(recordId, trackIds);
    const features = featuresResponse.audio_features.filter((f): f is SpotifyAudioFeatures => f !== null);
    
    if (features.length === 0) {
      return {
        mood: 'mixed',
        confidence: 0,
        reasoning: 'Could not analyze audio features',
      };
    }
    
    // Average the features
    const avgFeatures: SpotifyAudioFeatures = {
      danceability: features.reduce((a, b) => a + b.danceability, 0) / features.length,
      energy: features.reduce((a, b) => a + b.energy, 0) / features.length,
      key: Math.round(features.reduce((a, b) => a + b.key, 0) / features.length),
      loudness: features.reduce((a, b) => a + b.loudness, 0) / features.length,
      mode: Math.round(features.reduce((a, b) => a + b.mode, 0) / features.length),
      speechiness: features.reduce((a, b) => a + b.speechiness, 0) / features.length,
      acousticness: features.reduce((a, b) => a + b.acousticness, 0) / features.length,
      instrumentalness: features.reduce((a, b) => a + b.instrumentalness, 0) / features.length,
      liveness: features.reduce((a, b) => a + b.liveness, 0) / features.length,
      valence: features.reduce((a, b) => a + b.valence, 0) / features.length,
      tempo: features.reduce((a, b) => a + b.tempo, 0) / features.length,
      duration_ms: features.reduce((a, b) => a + b.duration_ms, 0) / features.length,
      time_signature: Math.round(features.reduce((a, b) => a + b.time_signature, 0) / features.length),
    };
    
    return inferMoodFromFeatures(avgFeatures);
  } catch (error) {
    console.error('[MOOD ANALYSIS] Failed to infer mood:', error);
    return {
      mood: 'mixed',
      confidence: 0,
      reasoning: 'Error analyzing listening patterns',
    };
  }
}

/**
 * Save mood patterns to Airtable
 */
export async function saveMoodPatterns(
  recordId: string,
  patterns: Record<'morning' | 'afternoon' | 'evening' | 'night', MoodPattern>
): Promise<void> {
  try {
    await updateUserRecord(recordId, {
      'Spotify Listening Patterns': JSON.stringify(patterns),
      'Spotify Last Sync': new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MOOD ANALYSIS] Failed to save patterns:', error);
    throw error;
  }
}

/**
 * Load mood patterns from Airtable
 */
export async function loadMoodPatterns(
  recordId: string
): Promise<Record<'morning' | 'afternoon' | 'evening' | 'night', MoodPattern> | null> {
  try {
    const userRecord = await getUserRecord(recordId);
    const fields = userRecord.fields;
    const patternsJson = fields['Spotify Listening Patterns'] as string | undefined;
    
    if (!patternsJson) {
      return null;
    }
    
    return JSON.parse(patternsJson);
  } catch (error) {
    console.error('[MOOD ANALYSIS] Failed to load patterns:', error);
    return null;
  }
}



