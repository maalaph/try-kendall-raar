import {
  getTopArtists,
  getTopTracks,
  SpotifyArtist,
  SpotifyTrack,
} from '@/lib/spotify/client';
import {
  inferCurrentMood,
  InferredMood,
} from '@/lib/spotify/moodAnalysis';

export type SpotifyTopOptions = {
  timeRange?: 'short_term' | 'medium_term' | 'long_term';
  limit?: number;
};

export type SpotifyInsights = {
  topArtists: SpotifyArtist[];
  topTracks: SpotifyTrack[];
  mood: InferredMood | null;
};

export class SpotifyIntegrationError extends Error {
  constructor(
    public reason: 'NOT_CONNECTED' | 'TOKEN_REFRESH_FAILED' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'SpotifyIntegrationError';
  }
}

function handleSpotifyError(error: any): never {
  const message = error?.message || 'Unknown Spotify integration error';

  if (message.includes('Spotify not connected')) {
    throw new SpotifyIntegrationError(
      'NOT_CONNECTED',
      'Spotify account not connected',
    );
  }

  if (
    message.includes('Failed to refresh Spotify token') ||
    message.includes('token expired')
  ) {
    throw new SpotifyIntegrationError(
      'TOKEN_REFRESH_FAILED',
      'Spotify token refresh failed',
    );
  }

  if (message.includes('401')) {
    throw new SpotifyIntegrationError(
      'TOKEN_REFRESH_FAILED',
      'Spotify authorization failed',
    );
  }

  throw new SpotifyIntegrationError('UNKNOWN', message);
}

export async function fetchSpotifyTopArtists(
  recordId: string,
  options: SpotifyTopOptions = {},
): Promise<SpotifyArtist[]> {
  try {
    const { timeRange = 'medium_term', limit = 10 } = options;
    const response = await getTopArtists(recordId, timeRange, limit);
    return response.items;
  } catch (error) {
    handleSpotifyError(error);
  }
}

export async function fetchSpotifyTopTracks(
  recordId: string,
  options: SpotifyTopOptions = {},
): Promise<SpotifyTrack[]> {
  try {
    const { timeRange = 'medium_term', limit = 10 } = options;
    const response = await getTopTracks(recordId, timeRange, limit);
    return response.items;
  } catch (error) {
    handleSpotifyError(error);
  }
}

export async function fetchSpotifyInsights(
  recordId: string,
  options: SpotifyTopOptions = {},
): Promise<SpotifyInsights> {
  try {
    const [topArtists, topTracks] = await Promise.all([
      fetchSpotifyTopArtists(recordId, options),
      fetchSpotifyTopTracks(recordId, options),
    ]);

    let mood: InferredMood | null = null;
    try {
      mood = await inferCurrentMood(recordId);
    } catch (moodError) {
      console.warn('[SPOTIFY INSIGHTS] Failed to infer mood:', moodError);
      mood = null;
    }

    return {
      topArtists,
      topTracks,
      mood,
    };
  } catch (error) {
    handleSpotifyError(error);
  }
}


