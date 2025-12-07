import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/database';
import { sanitizeRecordId } from '@/lib/utils';

/**
 * GET /api/auth/spotify/status?recordId=recXXXX
 *
 * Returns Spotify integration status for a user:
 * {
 *   connected: boolean;
 *   userId: string | null;
 *   displayName: string | null;
 *   email: string | null;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const rawRecordId = request.nextUrl.searchParams.get('recordId');

    if (!rawRecordId) {
      return NextResponse.json(
        { error: 'recordId query parameter is required' },
        { status: 400 },
      );
    }

    // Sanitize the recordId to remove any query string contamination
    const recordId = sanitizeRecordId(rawRecordId);
    if (!recordId) {
      return NextResponse.json(
        { 
          error: 'Invalid recordId format',
          message: `The recordId parameter has an invalid format. Expected format: rec[alphanumeric]`,
          received: rawRecordId.substring(0, 50), // Limit length for security
        },
        { status: 400 },
      );
    }

    const userRecord = await getUserRecord(recordId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (userRecord?.fields || {}) as any;

    // Check if Spotify token exists and is not expired
    const hasSpotifyToken = Boolean(fields.spotifyAccessToken);
    const tokenExpiresAt = fields.spotifyTokenExpiresAt 
      ? new Date(fields.spotifyTokenExpiresAt) 
      : null;
    const isTokenValid = hasSpotifyToken && (!tokenExpiresAt || tokenExpiresAt > new Date());

    const connected = isTokenValid;
    
    // Note: User ID, display name, and email would need to be stored separately
    // For now, we'll return null if not available
    // These could be fetched from Spotify API using the token if needed
    const userId = null; // Would need to be stored in database
    const displayName = null; // Would need to be stored in database
    const email = fields.email || null; // Use user's email if available

    return NextResponse.json({
      connected,
      userId,
      displayName,
      email,
    });
  } catch (error: any) {
    console.error('[SPOTIFY STATUS] Failed to fetch status:', {
      error: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch Spotify integration status',
        message: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}


