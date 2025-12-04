/**
 * Spotify Analytics System
 * Tracks listening time, top artists/tracks, and generates insights
 */

import { getRecentlyPlayed, getTopTracks, getTopArtists, SpotifyTrack } from './client';
import { getUserRecord, updateUserRecord } from '@/lib/airtable';

export interface ListeningAnalytics {
  totalListeningTime: number; // in minutes
  totalTracks: number;
  topArtists: Array<{ name: string; playCount: number }>;
  topTracks: Array<{ name: string; artist: string; playCount: number }>;
  listeningByHour: Record<number, number>; // hour -> play count
  listeningByDay: Record<string, number>; // day name -> play count
}

/**
 * Calculate listening time from recently played tracks
 */
export async function calculateListeningTime(
  recordId: string,
  days: number = 7
): Promise<number> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 50);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  let totalMs = 0;
  for (const item of recentlyPlayed.items) {
    const playedAt = new Date(item.played_at);
    if (playedAt >= cutoffDate) {
      totalMs += item.track.duration_ms;
    }
  }
  
  return Math.round(totalMs / 1000 / 60); // Convert to minutes
}

/**
 * Get top artists from listening history
 */
export async function getTopArtistsFromHistory(
  recordId: string,
  limit: number = 10
): Promise<Array<{ name: string; playCount: number }>> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 50);
  
  const artistCounts: Record<string, number> = {};
  
  for (const item of recentlyPlayed.items) {
    for (const artist of item.track.artists) {
      artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
    }
  }
  
  return Object.entries(artistCounts)
    .map(([name, playCount]) => ({ name, playCount }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Get top tracks from listening history
 */
export async function getTopTracksFromHistory(
  recordId: string,
  limit: number = 10
): Promise<Array<{ name: string; artist: string; playCount: number }>> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 50);
  
  const trackCounts: Record<string, { name: string; artist: string; count: number }> = {};
  
  for (const item of recentlyPlayed.items) {
    const key = item.track.id;
    if (!trackCounts[key]) {
      trackCounts[key] = {
        name: item.track.name,
        artist: item.track.artists[0]?.name || 'Unknown',
        count: 0,
      };
    }
    trackCounts[key].count++;
  }
  
  return Object.values(trackCounts)
    .map(({ name, artist, count }) => ({ name, artist, playCount: count }))
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * Analyze listening patterns by time
 */
export async function analyzeListeningPatterns(
  recordId: string
): Promise<{
  byHour: Record<number, number>;
  byDay: Record<string, number>;
}> {
  const recentlyPlayed = await getRecentlyPlayed(recordId, 50);
  
  const byHour: Record<number, number> = {};
  const byDay: Record<string, number> = {};
  
  for (const item of recentlyPlayed.items) {
    const playedAt = new Date(item.played_at);
    const hour = playedAt.getHours();
    const dayName = playedAt.toLocaleDateString('en-US', { weekday: 'long' });
    
    byHour[hour] = (byHour[hour] || 0) + 1;
    byDay[dayName] = (byDay[dayName] || 0) + 1;
  }
  
  return { byHour, byDay };
}

/**
 * Get comprehensive analytics
 */
export async function getAnalytics(
  recordId: string,
  timePeriod: 'week' | 'month' | 'all' = 'week'
): Promise<ListeningAnalytics> {
  const days = timePeriod === 'week' ? 7 : timePeriod === 'month' ? 30 : 365;
  
  const [listeningTime, topArtists, topTracks, patterns] = await Promise.all([
    calculateListeningTime(recordId, days),
    getTopArtistsFromHistory(recordId, 10),
    getTopTracksFromHistory(recordId, 10),
    analyzeListeningPatterns(recordId),
  ]);
  
  return {
    totalListeningTime: listeningTime,
    totalTracks: topTracks.length,
    topArtists,
    topTracks,
    listeningByHour: patterns.byHour,
    listeningByDay: patterns.byDay,
  };
}

/**
 * Generate human-readable insights
 */
export function generateInsights(analytics: ListeningAnalytics): string[] {
  const insights: string[] = [];
  
  // Listening time insight
  if (analytics.totalListeningTime > 0) {
    const hours = Math.floor(analytics.totalListeningTime / 60);
    const minutes = analytics.totalListeningTime % 60;
    if (hours > 0) {
      insights.push(`You've listened to ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''} of music.`);
    } else {
      insights.push(`You've listened to ${minutes} minute${minutes !== 1 ? 's' : ''} of music.`);
    }
  }
  
  // Top artist insight
  if (analytics.topArtists.length > 0) {
    const topArtist = analytics.topArtists[0];
    insights.push(`Your most played artist is ${topArtist.name} with ${topArtist.playCount} play${topArtist.playCount !== 1 ? 's' : ''}.`);
  }
  
  // Peak listening hour
  const peakHour = Object.entries(analytics.listeningByHour)
    .sort(([, a], [, b]) => b - a)[0];
  if (peakHour) {
    const hour = parseInt(peakHour[0]);
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    insights.push(`You listen most around ${hour12}${ampm}.`);
  }
  
  return insights;
}


