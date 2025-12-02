import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/google/oauth';
import { updateUserRecord } from '@/lib/airtable';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

/**
 * Get user info from Google using access token
 */
async function getUserInfo(accessToken: string) {
  try {
    // Use direct fetch instead of googleapis client to avoid auth issues
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
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
    console.error('[GOOGLE OAUTH] getUserInfo error:', error);
    // Return empty object if we can't get user info - we'll still save tokens
    return { email: null };
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
      console.error('[GOOGLE OAUTH] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/chat?oauth_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/chat?oauth_error=no_code', request.url)
      );
    }

    // Verify state token for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;
    const recordId = cookieStore.get('oauth_record_id')?.value;

    if (!storedState || storedState !== state) {
      console.error('[GOOGLE OAUTH] State mismatch');
      return NextResponse.redirect(
        new URL('/chat?oauth_error=state_mismatch', request.url)
      );
    }

    if (!recordId) {
      console.error('[GOOGLE OAUTH] No recordId found in cookie');
      return NextResponse.redirect(
        new URL('/chat?oauth_error=no_record_id', request.url)
      );
    }

    console.log('[GOOGLE OAUTH] Starting OAuth callback:', {
      recordId,
      hasCode: !!code,
      hasState: !!state,
    });

    // Exchange authorization code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    console.log('[GOOGLE OAUTH] Got tokens from Google:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
    });

    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new Error('Failed to get tokens from Google');
    }

    // Get user info to store email (optional - if it fails, we'll still save tokens)
    let userEmail = '';
    try {
      const userInfo = await getUserInfo(tokenData.access_token);
      console.log('[GOOGLE OAUTH] Got user info:', {
        email: userInfo.email,
      });
      userEmail = userInfo.email || '';
    } catch (userInfoError: any) {
      console.warn('[GOOGLE OAUTH] Could not get user info, continuing without email:', userInfoError.message);
      // Continue without email - tokens are more important
    }

    // Calculate token expiry
    const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour
    const tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

    // Store tokens in Airtable
    console.log('[GOOGLE OAUTH] Attempting to save to Airtable:', {
      recordId,
      email: userEmail,
    });
    
    try {
      await updateUserRecord(recordId, {
        'Google OAuth Access Token': tokenData.access_token,
        'Google OAuth Refresh Token': tokenData.refresh_token,
        'Google OAuth Token Expiry': tokenExpiry.toISOString(),
        'Google Calendar Connected': true,
        'Google Gmail Connected': true,
        'Google Email': userEmail,
      });
      console.log('[GOOGLE OAUTH] ✅ Successfully saved to Airtable');
    } catch (updateError: any) {
      console.error('[GOOGLE OAUTH] ❌ Failed to save to Airtable:', {
        error: updateError.message,
        recordId,
        stack: updateError.stack,
      });
      // Still redirect but with specific error
      return NextResponse.redirect(
        new URL(`/chat?recordId=${recordId}&oauth_error=airtable_save_failed&error_details=${encodeURIComponent(updateError.message)}`, request.url)
      );
    }

    // Clear OAuth cookies
    cookieStore.delete('oauth_state');
    cookieStore.delete('oauth_record_id');

    // Redirect back to chat with success
    console.log('[GOOGLE OAUTH] Redirecting to chat with success');
    return NextResponse.redirect(
      new URL(`/chat?recordId=${recordId}&oauth_success=true`, request.url)
    );
  } catch (error: any) {
    console.error('[GOOGLE OAUTH] Callback error:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.redirect(
      new URL('/chat?oauth_error=callback_failed', request.url)
    );
  }
}

