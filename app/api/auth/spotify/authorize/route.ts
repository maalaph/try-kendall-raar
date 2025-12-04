import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/spotify/oauth';
import { cookies } from 'next/headers';

/**
 * Generate OAuth state token for CSRF protection
 */
function generateStateToken(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export async function GET(request: NextRequest) {
  try {
    // Get recordId from query params (required to know which user is connecting)
    const recordId = request.nextUrl.searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Generate state token for CSRF protection
    // Encode recordId in state as fallback if cookies don't persist
    const stateToken = generateStateToken();
    const state = `${stateToken}:${Buffer.from(recordId).toString('base64')}`;
    
    // Store state in cookie with recordId for verification on callback
    const cookieStore = await cookies();
    
    cookieStore.set('spotify_oauth_state', stateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
    
    cookieStore.set('spotify_oauth_record_id', recordId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
    
    console.log('[SPOTIFY OAUTH] Set cookies:', {
      stateToken: `${stateToken.substring(0, 8)}...`,
      recordId,
      fullStateLength: state.length,
    });

    // Generate OAuth URL
    const authUrl = getSpotifyAuthUrl(state);

    // Redirect to Spotify OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[SPOTIFY OAUTH] Authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

