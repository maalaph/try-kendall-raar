import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getCallStats, getRecentCallNotes, getUnreadCallNotes } from '@/lib/airtable';
import { fetchGmailMessages, GoogleIntegrationError } from '@/lib/integrations/google';
import { fetchSpotifyInsights, SpotifyIntegrationError } from '@/lib/integrations/spotify';
import { getContactByPhone } from '@/lib/contacts';

/**
 * Normalize phone number for comparison (remove all non-digits, handle +1 prefix)
 */
function normalizePhoneForComparison(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  // Remove leading 1 if present (US country code)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.slice(1);
  }
  return cleaned;
}

/**
 * GET /api/dashboard
 * Get aggregated dashboard data for all integrations (Calls, Emails, Spotify)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get user record to find agentId and owner phone
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent not found for this user' },
        { status: 404 }
      );
    }

    // Fetch all integration data in parallel
    const [callsData, emailsData, spotifyData] = await Promise.allSettled([
      fetchCallsData(String(agentId), recordId),
      fetchEmailsData(recordId),
      fetchSpotifyData(recordId),
    ]);

    // Process calls data
    let calls = null;
    if (callsData.status === 'fulfilled') {
      calls = callsData.value;
    } else {
      console.error('[DASHBOARD] Calls data error:', callsData.reason);
    }

    // Process emails data
    let emails = null;
    if (emailsData.status === 'fulfilled') {
      emails = emailsData.value;
    } else {
      const error = emailsData.reason;
      if (error instanceof GoogleIntegrationError) {
        emails = {
          connected: false,
          error: error.reason === 'NOT_CONNECTED' ? 'not_connected' : 'error',
          message: error.message,
        };
      } else {
        console.error('[DASHBOARD] Emails data error:', error);
        emails = { connected: false, error: 'unknown', message: 'Failed to fetch emails' };
      }
    }

    // Process Spotify data
    let spotify = null;
    if (spotifyData.status === 'fulfilled') {
      spotify = spotifyData.value;
    } else {
      const error = spotifyData.reason;
      if (error instanceof SpotifyIntegrationError) {
        spotify = {
          connected: false,
          error: error.reason === 'NOT_CONNECTED' ? 'not_connected' : 'error',
          message: error.message,
        };
      } else {
        console.error('[DASHBOARD] Spotify data error:', error);
        spotify = { connected: false, error: 'unknown', message: 'Failed to fetch Spotify data' };
      }
    }

    return NextResponse.json({
      success: true,
      calls,
      emails,
      spotify,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/dashboard failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get dashboard data',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch calls data
 */
async function fetchCallsData(agentId: string, recordId: string) {
  const stats = await getCallStats(agentId);
  const unreadNotes = await getUnreadCallNotes(agentId);
  const recentActivity = await getRecentCallNotes(agentId, 10);

  // Batch lookup contacts for phone numbers
  const allPhones = new Set<string>();
  recentActivity.forEach(call => {
    if (call.callerPhone) allPhones.add(call.callerPhone);
  });

  const contactMap = new Map<string, string>();
  await Promise.all(
    Array.from(allPhones).map(async (phone) => {
      try {
        const contact = await getContactByPhone(recordId, phone);
        if (contact && contact.name) {
          contactMap.set(phone, contact.name);
        }
      } catch (error) {
        // Silently fail - just won't show name
      }
    })
  );

  const getDisplayName = (phone: string): string => {
    return contactMap.get(phone) || phone;
  };

  return {
    connected: true,
    summary: {
      totalCalls: stats.totalCalls,
      unreadMessages: unreadNotes.length,
      averageCallDuration: stats.averageCallDuration, // in seconds
      totalCallMinutes: stats.totalCallMinutes,
    },
    details: {
      recentActivity: recentActivity.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        callerName: getDisplayName(note.callerPhone),
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
    },
  };
}

/**
 * Fetch emails data
 */
async function fetchEmailsData(recordId: string) {
  // Fetch unread emails
  const unreadMessages = await fetchGmailMessages(recordId, {
    unread: true,
    maxResults: 20,
  });

  // Fetch recent emails (last 24-48 hours)
  const recentMessages = await fetchGmailMessages(recordId, {
    unread: false,
    maxResults: 20,
  });

  // Calculate most frequent sender from recent messages
  const senderCounts = new Map<string, number>();
  recentMessages.forEach(msg => {
    const sender = msg.from || 'Unknown';
    senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
  });

  let mostFrequentSender = null;
  let maxCount = 0;
  senderCounts.forEach((count, sender) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentSender = sender;
    }
  });

  return {
    connected: true,
    summary: {
      unreadCount: unreadMessages.length,
      recentCount: recentMessages.length,
      mostFrequentSender: mostFrequentSender || null,
    },
    details: {
      unreadMessages: unreadMessages.slice(0, 10),
      recentMessages: recentMessages.slice(0, 10),
    },
  };
}

/**
 * Fetch Spotify data
 */
async function fetchSpotifyData(recordId: string) {
  const insights = await fetchSpotifyInsights(recordId, {
    timeRange: 'medium_term',
    limit: 10,
  });

  return {
    connected: true,
    summary: {
      topArtist: insights.topArtists[0]?.name || null,
      topTrack: insights.topTracks[0]?.name || null,
      mood: insights.mood?.label || null,
    },
    details: {
      topArtists: insights.topArtists.slice(0, 10),
      topTracks: insights.topTracks.slice(0, 10),
      mood: insights.mood,
    },
  };
}

