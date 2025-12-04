/**
 * Google Calendar API wrapper
 */

import { google } from 'googleapis';
import { refreshAccessToken } from './oauth';
import { getUserRecord, updateUserRecord } from '@/lib/airtable';

/**
 * Get authenticated Calendar API client for a user
 */
export async function getCalendarClient(userId: string) {
  const userRecord = await getUserRecord(userId);
  const accessToken = userRecord.fields['Google OAuth Access Token'];
  const refreshToken = userRecord.fields['Google OAuth Refresh Token'];
  const tokenExpiry = userRecord.fields['Google OAuth Token Expiry'];

  if (!accessToken || !refreshToken) {
    throw new Error('Google account not connected. Please connect your Google account first.');
  }

  // Check if token needs refresh
  const now = new Date();
  const expiryDate = tokenExpiry ? new Date(tokenExpiry) : null;
  
  let finalAccessToken = accessToken;

  if (!expiryDate || expiryDate <= now) {
    // Token expired, refresh it
    try {
      const tokenData = await refreshAccessToken(refreshToken);
      finalAccessToken = tokenData.access_token;
      
      // Update Airtable with new token
      const newExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
      await updateUserRecord(userId, {
        'Google OAuth Access Token': tokenData.access_token,
        'Google OAuth Token Expiry': newExpiry.toISOString(),
      });
    } catch (error) {
      throw new Error('Failed to refresh access token. Please reconnect your Google account.');
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: finalAccessToken,
    refresh_token: refreshToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Get user's calendar events
 */
export async function getUserEvents(
  userId: string,
  timeMin: string,
  timeMax: string
) {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

/**
 * Get free/busy information
 */
export async function getFreeBusy(
  userId: string,
  timeMin: string,
  timeMax: string
) {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    },
  });

  return response.data;
}

/**
 * Create a calendar event
 */
export async function createEvent(
  userId: string,
  eventData: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }
) {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventData,
  });

  return response.data;
}

/**
 * Update a calendar event
 */
export async function updateEvent(
  userId: string,
  eventId: string,
  eventData: Partial<{
    summary: string;
    description: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
  }>
) {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    requestBody: eventData,
  });

  return response.data;
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(userId: string, eventId: string) {
  const calendar = await getCalendarClient(userId);
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}



