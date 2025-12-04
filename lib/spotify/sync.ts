/**
 * Background Sync Job
 * Periodically syncs listening history, updates mood patterns, and refreshes analytics
 */

import { getAllUserRecords } from '@/lib/airtable';
import { analyzeTimeBasedPatterns, saveMoodPatterns } from './moodAnalysis';
import { getAnalytics } from './analytics';

/**
 * Sync Spotify data for a single user
 */
export async function syncUserSpotifyData(recordId: string): Promise<void> {
  try {
    console.log(`[SPOTIFY SYNC] Starting sync for user ${recordId}`);
    
    // Check if user has Spotify connected
    const { getUserRecord } = await import('@/lib/airtable');
    const userRecord = await getUserRecord(recordId);
    const fields = userRecord.fields;
    
    if (!fields['Spotify Connected']) {
      console.log(`[SPOTIFY SYNC] User ${recordId} does not have Spotify connected, skipping`);
      return;
    }
    
    // Analyze time-based patterns
    try {
      const patterns = await analyzeTimeBasedPatterns(recordId);
      await saveMoodPatterns(recordId, patterns);
      console.log(`[SPOTIFY SYNC] Updated mood patterns for user ${recordId}`);
    } catch (error) {
      console.error(`[SPOTIFY SYNC] Failed to update mood patterns for user ${recordId}:`, error);
    }
    
    // Update last sync timestamp
    const { updateUserRecord } = await import('@/lib/airtable');
    await updateUserRecord(recordId, {
      'Spotify Last Sync': new Date().toISOString(),
    });
    
    console.log(`[SPOTIFY SYNC] Completed sync for user ${recordId}`);
  } catch (error) {
    console.error(`[SPOTIFY SYNC] Error syncing user ${recordId}:`, error);
    throw error;
  }
}

/**
 * Sync Spotify data for all users with Spotify connected
 */
export async function syncAllUsersSpotifyData(): Promise<void> {
  try {
    console.log('[SPOTIFY SYNC] Starting sync for all users');
    
    const allUsers = await getAllUserRecords();
    const spotifyUsers = allUsers.filter(user => 
      user.fields['Spotify Connected'] === true
    );
    
    console.log(`[SPOTIFY SYNC] Found ${spotifyUsers.length} users with Spotify connected`);
    
    for (const user of spotifyUsers) {
      try {
        await syncUserSpotifyData(user.id);
      } catch (error) {
        console.error(`[SPOTIFY SYNC] Failed to sync user ${user.id}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    console.log('[SPOTIFY SYNC] Completed sync for all users');
  } catch (error) {
    console.error('[SPOTIFY SYNC] Error syncing all users:', error);
    throw error;
  }
}

/**
 * API endpoint handler for manual sync trigger
 */
export async function handleSyncRequest(recordId?: string): Promise<{ success: boolean; message: string }> {
  try {
    if (recordId) {
      await syncUserSpotifyData(recordId);
      return { success: true, message: 'Sync completed successfully' };
    } else {
      await syncAllUsersSpotifyData();
      return { success: true, message: 'Sync completed for all users' };
    }
  } catch (error: any) {
    console.error('[SPOTIFY SYNC] Sync request failed:', error);
    return { success: false, message: error.message || 'Sync failed' };
  }
}


