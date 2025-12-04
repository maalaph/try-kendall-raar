/**
 * Google API helper functions for accessing Calendar and Gmail
 * Uses stored OAuth tokens from Airtable
 */

import { google } from 'googleapis';
import { getUserRecord, updateUserRecord } from '@/lib/airtable';
import { refreshAccessToken, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from './oauth';

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiry: Date | null;
}

/**
 * Get OAuth tokens from Airtable for a given recordId
 */
export async function getGoogleTokens(recordId: string): Promise<GoogleTokens | null> {
  try {
    const userRecord = await getUserRecord(recordId);
    const fields = userRecord.fields;

    const accessToken = fields['Google OAuth Access Token'] as string | undefined;
    const refreshToken = fields['Google OAuth Refresh Token'] as string | undefined;
    const tokenExpiry = fields['Google OAuth Token Expiry'] as string | undefined;

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiry: tokenExpiry ? new Date(tokenExpiry) : null,
    };
  } catch (error) {
    console.error('[GOOGLE API] Failed to get tokens from Airtable:', error);
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
 * Refresh access token if expired and update Airtable
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

    // Update Airtable with new token
    await updateUserRecord(recordId, {
      'Google OAuth Access Token': tokenData.access_token,
      'Google OAuth Token Expiry': tokenExpiry.toISOString(),
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



