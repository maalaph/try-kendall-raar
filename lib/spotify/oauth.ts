/**
 * Spotify OAuth configuration and helper functions
 */

// OAuth scopes for Spotify Web API
export const SPOTIFY_SCOPES = [
  'user-read-recently-played', // Access recently played tracks
  'user-top-read', // Access top tracks and artists
  'user-read-currently-playing', // Access currently playing track
  'user-read-playback-state', // Access playback state
  'user-library-read', // Access saved tracks/albums
  'playlist-read-private', // Access private playlists
  'user-read-email', // Access user email
];

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
export const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/api/auth/spotify/callback';

/**
 * Generate OAuth authorization URL
 */
export function getSpotifyAuthUrl(state: string): string {
  // Debug logging
  if (!SPOTIFY_CLIENT_ID) {
    console.error('[SPOTIFY OAUTH] ERROR: SPOTIFY_CLIENT_ID is not set in environment variables!');
  }
  if (!SPOTIFY_CLIENT_SECRET) {
    console.error('[SPOTIFY OAUTH] ERROR: SPOTIFY_CLIENT_SECRET is not set in environment variables!');
  }
  console.log('[SPOTIFY OAUTH] Generating auth URL with:', {
    clientId: SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 8)}...` : 'MISSING',
    redirectUri: SPOTIFY_REDIRECT_URI,
  });

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    response_type: 'code',
    scope: SPOTIFY_SCOPES.join(' '),
    state: state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}

