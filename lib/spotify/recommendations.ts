/**
 * Recommendation Engine
 * Provides music recommendations based on user preferences and mood
 */

import {
  getTopArtists,
  getTopTracks,
  getRecommendations,
  searchArtists,
  SpotifyTrack,
  SpotifyArtist,
} from './client';
import { inferCurrentMood, loadMoodPatterns, MoodPattern } from './moodAnalysis';

export interface RecommendationOptions {
  artistName?: string;
  mood?: 'energetic' | 'relaxed' | 'happy' | 'contemplative' | 'focused';
  genre?: string;
  limit?: number;
}

/**
 * Get recommendations based on favorite artists
 */
export async function getRecommendationsFromFavoriteArtists(
  recordId: string,
  limit: number = 20
): Promise<SpotifyTrack[]> {
  try {
    // Get top artists
    const topArtists = await getTopArtists(recordId, 'medium_term', 5);
    
    if (topArtists.items.length === 0) {
      throw new Error('No favorite artists found. Listen to more music to get recommendations.');
    }
    
    // Use top artists as seeds
    const seedArtists = topArtists.items.slice(0, 5).map(artist => artist.id);
    
    const recommendations = await getRecommendations(recordId, {
      seed_artists: seedArtists,
      limit,
    });
    
    return recommendations.tracks;
  } catch (error) {
    console.error('[RECOMMENDATIONS] Failed to get recommendations from favorite artists:', error);
    throw error;
  }
}

/**
 * Get recommendations for a specific artist
 */
export async function getRecommendationsForArtist(
  recordId: string,
  artistName: string,
  limit: number = 20
): Promise<SpotifyTrack[]> {
  try {
    // Search for the artist
    const searchResults = await searchArtists(recordId, artistName, 1);
    
    if (searchResults.artists.items.length === 0) {
      throw new Error(`Artist "${artistName}" not found.`);
    }
    
    const artist = searchResults.artists.items[0];
    
    // Get top tracks from this artist
    const topTracks = await getTopTracks(recordId, 'medium_term', 5);
    const artistTracks = topTracks.items.filter(track =>
      track.artists.some(a => a.id === artist.id)
    );
    
    // Use artist and their tracks as seeds
    const seedArtists = [artist.id];
    const seedTracks = artistTracks.slice(0, 3).map(track => track.id);
    
    const recommendations = await getRecommendations(recordId, {
      seed_artists: seedArtists,
      seed_tracks: seedTracks.length > 0 ? seedTracks : undefined,
      limit,
    });
    
    return recommendations.tracks;
  } catch (error) {
    console.error('[RECOMMENDATIONS] Failed to get recommendations for artist:', error);
    throw error;
  }
}

/**
 * Get mood-based recommendations
 */
export async function getMoodBasedRecommendations(
  recordId: string,
  mood: 'energetic' | 'relaxed' | 'happy' | 'contemplative' | 'focused',
  limit: number = 20
): Promise<SpotifyTrack[]> {
  try {
    // Get top tracks for seed
    const topTracks = await getTopTracks(recordId, 'medium_term', 5);
    const seedTracks = topTracks.items.slice(0, 5).map(track => track.id);
    
    // Map mood to audio feature targets
    const moodTargets: Record<string, { energy?: number; valence?: number; tempo?: number }> = {
      energetic: { energy: 0.8, valence: 0.7, tempo: 130 },
      relaxed: { energy: 0.3, valence: 0.6, tempo: 80 },
      happy: { energy: 0.6, valence: 0.8, tempo: 120 },
      contemplative: { energy: 0.4, valence: 0.3, tempo: 90 },
      focused: { energy: 0.5, valence: 0.5, tempo: 110 },
    };
    
    const targets = moodTargets[mood] || {};
    
    const recommendations = await getRecommendations(recordId, {
      seed_tracks: seedTracks,
      limit,
      target_energy: targets.energy,
      target_valence: targets.valence,
      target_tempo: targets.tempo,
    });
    
    return recommendations.tracks;
  } catch (error) {
    console.error('[RECOMMENDATIONS] Failed to get mood-based recommendations:', error);
    throw error;
  }
}

/**
 * Get context-aware recommendations based on time of day and patterns
 */
export async function getContextAwareRecommendations(
  recordId: string,
  limit: number = 20
): Promise<SpotifyTrack[]> {
  try {
    // Load mood patterns
    const patterns = await loadMoodPatterns(recordId);
    
    // Get current time of day
    const hour = new Date().getHours();
    const timeOfDay = hour >= 5 && hour < 12 ? 'morning' :
                     hour >= 12 && hour < 17 ? 'afternoon' :
                     hour >= 17 && hour < 22 ? 'evening' : 'night';
    
    // Get pattern for current time of day
    let pattern: MoodPattern | null = null;
    if (patterns) {
      pattern = patterns[timeOfDay];
    }
    
    // Get top tracks for seed
    const topTracks = await getTopTracks(recordId, 'medium_term', 5);
    const seedTracks = topTracks.items.slice(0, 5).map(track => track.id);
    
    // Use pattern to target audio features, or use inferred mood
    let options: any = {
      seed_tracks: seedTracks,
      limit,
    };
    
    if (pattern) {
      options.target_energy = pattern.energy;
      options.target_valence = pattern.valence;
      options.target_tempo = pattern.tempo;
    } else {
      // Fallback to inferred mood
      const currentMood = await inferCurrentMood(recordId);
      if (currentMood.mood !== 'mixed') {
        const moodTargets: Record<string, { energy?: number; valence?: number; tempo?: number }> = {
          energetic: { energy: 0.8, valence: 0.7, tempo: 130 },
          relaxed: { energy: 0.3, valence: 0.6, tempo: 80 },
          happy: { energy: 0.6, valence: 0.8, tempo: 120 },
          contemplative: { energy: 0.4, valence: 0.3, tempo: 90 },
          focused: { energy: 0.5, valence: 0.5, tempo: 110 },
        };
        const targets = moodTargets[currentMood.mood] || {};
        options = { ...options, ...targets };
      }
    }
    
    const recommendations = await getRecommendations(recordId, options);
    return recommendations.tracks;
  } catch (error) {
    console.error('[RECOMMENDATIONS] Failed to get context-aware recommendations:', error);
    throw error;
  }
}

/**
 * Get recommendations based on user's request
 */
export async function getRecommendationsForUser(
  recordId: string,
  options: RecommendationOptions
): Promise<SpotifyTrack[]> {
  const { artistName, mood, limit = 20 } = options;
  
  // If specific artist requested
  if (artistName) {
    return getRecommendationsForArtist(recordId, artistName, limit);
  }
  
  // If specific mood requested
  if (mood) {
    return getMoodBasedRecommendations(recordId, mood, limit);
  }
  
  // Default: context-aware recommendations
  return getContextAwareRecommendations(recordId, limit);
}



