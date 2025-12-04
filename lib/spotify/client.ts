/**
 * Spotify API Client with token management
 */

import { getUserRecord, updateUserRecord } from '@/lib/airtable';
import { refreshAccessToken } from './oauth';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  external_urls: { spotify: string };
  preview_url: string | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
  external_urls: { spotify: string };
  genres: string[];
}

export interface SpotifyAudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

/**
 * Get valid access token, refreshing if necessary
 */
async function getValidAccessToken(recordId: string): Promise<string> {
  const userRecord = await getUserRecord(recordId);
  const fields = userRecord.fields;

  const accessToken = fields['Spotify OAuth Access Token'] as string | undefined;
  const refreshToken = fields['Spotify OAuth Refresh Token'] as string | undefined;
  const tokenExpiry = fields['Spotify OAuth Token Expiry'] as string | undefined;

  if (!accessToken) {
    throw new Error('Spotify not connected. Please connect your Spotify account first.');
  }

  // Check if token is expired (with 5 minute buffer)
  const expiryTime = tokenExpiry ? new Date(tokenExpiry).getTime() : 0;
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes

  if (expiryTime && now >= expiryTime - buffer) {
    // Token expired or about to expire, refresh it
    if (!refreshToken) {
      throw new Error('Spotify token expired and no refresh token available. Please reconnect your Spotify account.');
    }

    console.log('[SPOTIFY CLIENT] Refreshing expired token');
    try {
      const tokenData = await refreshAccessToken(refreshToken);
      const newExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      await updateUserRecord(recordId, {
        'Spotify OAuth Access Token': tokenData.access_token,
        'Spotify OAuth Token Expiry': newExpiry.toISOString(),
      });

      return tokenData.access_token;
    } catch (error) {
      console.error('[SPOTIFY CLIENT] Token refresh failed:', error);
      throw new Error('Failed to refresh Spotify token. Please reconnect your account.');
    }
  }

  return accessToken;
}

/**
 * Make authenticated request to Spotify API
 */
async function spotifyRequest<T>(
  recordId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getValidAccessToken(recordId);

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Get user's top tracks
 */
export async function getTopTracks(
  recordId: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<{ items: SpotifyTrack[] }> {
  return spotifyRequest<{ items: SpotifyTrack[] }>(
    recordId,
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
  );
}

/**
 * Get user's top artists
 */
export async function getTopArtists(
  recordId: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<{ items: SpotifyArtist[] }> {
  return spotifyRequest<{ items: SpotifyArtist[] }>(
    recordId,
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`
  );
}

/**
 * Get user's recently played tracks
 */
export async function getRecentlyPlayed(
  recordId: string,
  limit: number = 50
): Promise<{
  items: Array<{
    track: SpotifyTrack;
    played_at: string;
  }>;
}> {
  return spotifyRequest(
    recordId,
    `/me/player/recently-played?limit=${limit}`
  );
}

/**
 * Get currently playing track
 */
export async function getCurrentlyPlaying(recordId: string): Promise<{
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number;
} | null> {
  try {
    return await spotifyRequest(
      recordId,
      '/me/player/currently-playing'
    );
  } catch (error: any) {
    // If nothing is playing, Spotify returns 204 No Content
    if (error.message?.includes('204')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get user's playlists
 */
export async function getPlaylists(
  recordId: string,
  limit: number = 50
): Promise<{
  items: Array<{
    id: string;
    name: string;
    description: string;
    images: Array<{ url: string }>;
    tracks: { total: number };
  }>;
}> {
  return spotifyRequest(
    recordId,
    `/me/playlists?limit=${limit}`
  );
}

/**
 * Search for tracks
 */
export async function searchTracks(
  recordId: string,
  query: string,
  limit: number = 20
): Promise<{
  tracks: {
    items: SpotifyTrack[];
  };
}> {
  const encodedQuery = encodeURIComponent(query);
  return spotifyRequest(
    recordId,
    `/search?q=${encodedQuery}&type=track&limit=${limit}`
  );
}

/**
 * Search for artists
 */
export async function searchArtists(
  recordId: string,
  query: string,
  limit: number = 20
): Promise<{
  artists: {
    items: SpotifyArtist[];
  };
}> {
  const encodedQuery = encodeURIComponent(query);
  return spotifyRequest(
    recordId,
    `/search?q=${encodedQuery}&type=artist&limit=${limit}`
  );
}

/**
 * Get track details
 */
export async function getTrack(recordId: string, trackId: string): Promise<SpotifyTrack> {
  return spotifyRequest<SpotifyTrack>(recordId, `/tracks/${trackId}`);
}

/**
 * Get artist details
 */
export async function getArtist(recordId: string, artistId: string): Promise<SpotifyArtist> {
  return spotifyRequest<SpotifyArtist>(recordId, `/artists/${artistId}`);
}

/**
 * Get audio features for tracks
 */
export async function getAudioFeatures(
  recordId: string,
  trackIds: string[]
): Promise<{
  audio_features: Array<SpotifyAudioFeatures | null>;
}> {
  const ids = trackIds.join(',');
  return spotifyRequest(
    recordId,
    `/audio-features?ids=${ids}`
  );
}

/**
 * Get recommendations based on seed tracks/artists
 */
export async function getRecommendations(
  recordId: string,
  options: {
    seed_tracks?: string[];
    seed_artists?: string[];
    seed_genres?: string[];
    limit?: number;
    target_energy?: number;
    target_valence?: number;
    target_tempo?: number;
  } = {}
): Promise<{
  tracks: SpotifyTrack[];
}> {
  const params = new URLSearchParams();
  
  if (options.seed_tracks) {
    params.append('seed_tracks', options.seed_tracks.join(','));
  }
  if (options.seed_artists) {
    params.append('seed_artists', options.seed_artists.join(','));
  }
  if (options.seed_genres) {
    params.append('seed_genres', options.seed_genres.join(','));
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options.target_energy !== undefined) {
    params.append('target_energy', options.target_energy.toString());
  }
  if (options.target_valence !== undefined) {
    params.append('target_valence', options.target_valence.toString());
  }
  if (options.target_tempo !== undefined) {
    params.append('target_tempo', options.target_tempo.toString());
  }

  return spotifyRequest(
    recordId,
    `/recommendations?${params.toString()}`
  );
}


