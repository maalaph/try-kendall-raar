/**
 * Google Gmail API wrapper (light, non-restricted scopes)
 */

import { google } from 'googleapis';
import { refreshAccessToken } from './oauth';
import { getUserRecord, updateUserRecord } from '@/lib/airtable';

/**
 * Get authenticated Gmail API client for a user
 */
export async function getGmailClient(userId: string) {
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

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Get user's email labels
 */
export async function getLabels(userId: string) {
  const gmail = await getGmailClient(userId);
  
  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  return response.data.labels || [];
}

/**
 * Get message metadata (headers, no body)
 */
export async function getMessageMetadata(userId: string, messageId: string) {
  const gmail = await getGmailClient(userId);
  
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  });

  return response.data;
}

/**
 * Search messages by metadata (no body access)
 */
export async function searchMessages(userId: string, query: string) {
  const gmail = await getGmailClient(userId);
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
  });

  return response.data.messages || [];
}

/**
 * Create a label
 */
export async function createLabel(userId: string, labelName: string) {
  const gmail = await getGmailClient(userId);
  
  const response = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });

  return response.data;
}

/**
 * Update a label
 */
export async function updateLabel(userId: string, labelId: string, updates: { name?: string }) {
  const gmail = await getGmailClient(userId);
  
  const response = await gmail.users.labels.patch({
    userId: 'me',
    id: labelId,
    requestBody: updates,
  });

  return response.data;
}

/**
 * Delete a label
 */
export async function deleteLabel(userId: string, labelId: string) {
  const gmail = await getGmailClient(userId);
  
  await gmail.users.labels.delete({
    userId: 'me',
    id: labelId,
  });
}



