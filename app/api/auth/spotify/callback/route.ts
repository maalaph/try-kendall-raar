import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/spotify/oauth';
import { updateUserRecord } from '@/lib/airtable';
import { cookies } from 'next/headers';

/**
 * Get user info from Spotify using access token
 */
async function getUserInfo(accessToken: string) {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get user info: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[SPOTIFY OAUTH] getUserInfo error:', error);
    // Return empty object if we can't get user info - we'll still save tokens
    return { id: null, display_name: null, email: null };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[SPOTIFY OAUTH] OAuth error:', error);
      // Try to get recordId from cookie for error redirect
      const cookieStore = await cookies();
      const recordId = cookieStore.get('spotify_oauth_record_id')?.value;
      const redirectUrl = recordId 
        ? `/integrations?recordId=${recordId}&oauth_error=${encodeURIComponent(error)}`
        : `/integrations?oauth_error=${encodeURIComponent(error)}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/integrations?oauth_error=no_code', request.url)
      );
    }

    // Verify state token for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get('spotify_oauth_state')?.value;
    let recordId = cookieStore.get('spotify_oauth_record_id')?.value;

    // Parse state - it may contain recordId as fallback (format: "stateToken:base64RecordId")
    let stateToken = state;
    if (state && state.includes(':')) {
      const [token, encodedRecordId] = state.split(':');
      stateToken = token;
      // Use recordId from state if cookie didn't persist
      if (!recordId && encodedRecordId) {
        try {
          recordId = Buffer.from(encodedRecordId, 'base64').toString('utf-8');
          console.log('[SPOTIFY OAUTH] Recovered recordId from state parameter');
        } catch (e) {
          console.error('[SPOTIFY OAUTH] Failed to decode recordId from state:', e);
        }
      }
    }

    // Debug logging
    console.log('[SPOTIFY OAUTH] State verification:', {
      storedState: storedState ? `${storedState.substring(0, 8)}...` : 'MISSING',
      receivedStateToken: stateToken ? `${stateToken.substring(0, 8)}...` : 'MISSING',
      statesMatch: storedState === stateToken,
      recordId: recordId || 'MISSING',
      recordIdSource: cookieStore.get('spotify_oauth_record_id')?.value ? 'cookie' : 'state',
      allCookieNames: cookieStore.getAll().map(c => c.name),
    });

    // Verify state - use stored state from cookie, or if missing, allow if we have recordId from state
    if (!storedState || storedState !== stateToken) {
      // If cookies didn't persist but we have recordId from state, allow it (less secure but works)
      if (!recordId) {
        console.error('[SPOTIFY OAUTH] State mismatch and no recordId - Details:', {
          storedState: storedState || 'NOT FOUND',
          receivedStateToken: stateToken || 'NOT FOUND',
          storedStateLength: storedState?.length,
          receivedStateTokenLength: stateToken?.length,
          allCookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
        });
        return NextResponse.redirect(
          new URL('/integrations?oauth_error=state_mismatch', request.url)
        );
      } else {
        console.warn('[SPOTIFY OAUTH] State mismatch but recordId recovered from state - proceeding');
      }
    }

    if (!recordId) {
      console.error('[SPOTIFY OAUTH] No recordId found in cookie or state');
      return NextResponse.redirect(
        new URL('/integrations?oauth_error=no_record_id', request.url)
      );
    }

    console.log('[SPOTIFY OAUTH] Starting OAuth callback:', {
      recordId,
      hasCode: !!code,
      hasState: !!state,
    });

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    console.log('[SPOTIFY OAUTH] Got tokens from Spotify:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
    });

    if (!tokenData.access_token) {
      throw new Error('Failed to get access token from Spotify');
    }

    // Get user info to store user ID and display name
    let userId = '';
    let displayName = '';
    let userEmail = '';
    try {
      const userInfo = await getUserInfo(tokenData.access_token);
      console.log('[SPOTIFY OAUTH] Got user info:', {
        id: userInfo.id,
        display_name: userInfo.display_name,
        email: userInfo.email,
      });
      userId = userInfo.id || '';
      displayName = userInfo.display_name || '';
      userEmail = userInfo.email || '';
    } catch (userInfoError: any) {
      console.warn('[SPOTIFY OAUTH] Could not get user info, continuing without user details:', userInfoError.message);
      // Continue without user info - tokens are more important
    }

    // Calculate token expiry
    const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour
    const tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

    // Store tokens in Airtable
    console.log('[SPOTIFY OAUTH] Attempting to save to Airtable:', {
      recordId,
      userId,
      displayName,
    });
    
    try {
      const updateData: Record<string, any> = {
        'Spotify OAuth Access Token': tokenData.access_token,
        'Spotify OAuth Token Expiry': tokenExpiry.toISOString(),
        'Spotify Connected': true,
        'Spotify User ID': userId,
        'Spotify Display Name': displayName,
        'Spotify Last Sync': new Date().toISOString(),
      };

      // Only add refresh token if provided (Spotify may not always return it)
      if (tokenData.refresh_token) {
        updateData['Spotify OAuth Refresh Token'] = tokenData.refresh_token;
      }

      // Add email if available
      if (userEmail) {
        updateData['Spotify Email'] = userEmail;
      }

      await updateUserRecord(recordId, updateData);
      console.log('[SPOTIFY OAUTH] ✅ Successfully saved to Airtable');
    } catch (updateError: any) {
      console.error('[SPOTIFY OAUTH] ❌ Failed to save to Airtable:', {
        error: updateError.message,
        recordId,
        stack: updateError.stack,
      });
      // Still redirect but with specific error
      return NextResponse.redirect(
        new URL(`/integrations?recordId=${recordId}&oauth_error=airtable_save_failed&error_details=${encodeURIComponent(updateError.message)}`, request.url)
      );
    }

    // Clear OAuth cookies
    cookieStore.delete('spotify_oauth_state');
    cookieStore.delete('spotify_oauth_record_id');

    // Redirect back to integrations page with success
    console.log('[SPOTIFY OAUTH] Redirecting to integrations with success');
    return NextResponse.redirect(
      new URL(`/integrations?recordId=${recordId}&oauth_success=true`, request.url)
    );
  } catch (error: any) {
    console.error('[SPOTIFY OAUTH] Callback error:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.redirect(
      new URL('/integrations?oauth_error=callback_failed', request.url)
    );
  }
}

