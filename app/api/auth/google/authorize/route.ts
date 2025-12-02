import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google/oauth';
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
    const state = generateStateToken();
    
    // Store state in cookie with recordId for verification on callback
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    
    cookieStore.set('oauth_record_id', recordId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Generate OAuth URL
    const authUrl = getGoogleAuthUrl(state);

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GOOGLE OAUTH] Authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

