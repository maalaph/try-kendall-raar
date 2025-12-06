/**
 * Google API helper functions for accessing Calendar and Gmail
 * Uses stored OAuth tokens from database
 */

import { google } from 'googleapis';
import { getUserOAuthTokens, updateUserOAuthTokens } from '@/lib/database';
import { refreshAccessToken, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from './oauth';

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiry: Date | null;
}

/**
 * Get OAuth tokens from database for a given recordId
 */
export async function getGoogleTokens(recordId: string): Promise<GoogleTokens | null> {
  try {
    const tokens = await getUserOAuthTokens(recordId);

    if (!tokens.google || !tokens.google.accessToken || !tokens.google.refreshToken) {
      return null;
    }

    return {
      accessToken: tokens.google.accessToken,
      refreshToken: tokens.google.refreshToken,
      expiry: tokens.google.expiresAt ? new Date(tokens.google.expiresAt) : null,
    };
  } catch (error) {
    console.error('[GOOGLE API] Failed to get tokens from database:', error);
    return null;
  }
}

/**
 * Check if access token is expired (or will expire in the next 5 minutes)
 */
function isTokenExpired(expiry: Date | null): boolean {
  if (!expiry) return true;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  return expiry <= fiveMinutesFromNow;
}

/**
 * Refresh access token if expired and update database
 */
export async function ensureValidAccessToken(recordId: string, tokens: GoogleTokens): Promise<string> {
  if (!isTokenExpired(tokens.expiry)) {
    return tokens.accessToken;
  }

  console.log('[GOOGLE API] Access token expired, refreshing...');
  
  try {
    const tokenData = await refreshAccessToken(tokens.refreshToken);
    
    if (!tokenData.access_token) {
      throw new Error('No access token in refresh response');
    }

    // Calculate new expiry
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

    // Update database with new token
    await updateUserOAuthTokens(recordId, {
      google: {
        accessToken: tokenData.access_token,
        refreshToken: tokens.refreshToken, // Keep existing refresh token
        expiresAt: tokenExpiry.toISOString(),
      },
    });

    console.log('[GOOGLE API] Token refreshed successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('[GOOGLE API] Failed to refresh token:', error);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Create an authenticated OAuth2 client for Google APIs
 */
export async function getAuthenticatedGoogleClient(recordId: string) {
  const tokens = await getGoogleTokens(recordId);
  
  if (!tokens) {
    throw new Error('Google account not connected. Please connect your Google account in the Integrations page.');
  }

  const accessToken = await ensureValidAccessToken(recordId, tokens);

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: tokens.refreshToken,
  });

  return oauth2Client;
}

/**
 * Get authenticated Calendar API client
 */
export async function getCalendarClient(recordId: string) {
  const auth = await getAuthenticatedGoogleClient(recordId);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Get authenticated Gmail API client
 */
export async function getGmailClient(recordId: string) {
  const auth = await getAuthenticatedGoogleClient(recordId);
  return google.gmail({ version: 'v1', auth });
}





