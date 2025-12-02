import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getCallStats, getRecentCallNotes, getUnreadCallNotes } from '@/lib/airtable';

/**
 * GET /api/stats
 * Get call statistics for a user's agent
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

    // Get user record to find agentId
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

    // Get call statistics
    const stats = await getCallStats(String(agentId));

    // Get unread messages count
    const unreadNotes = await getUnreadCallNotes(String(agentId));

    // Get recent activity (last 10 call notes)
    const recentActivity = await getRecentCallNotes(String(agentId), 10);

    return NextResponse.json({
      success: true,
      totalCalls: stats.totalCalls,
      totalCallMinutes: stats.totalCallMinutes,
      averageCallDuration: stats.averageCallDuration, // in seconds
      unreadMessages: unreadNotes.length,
      recentActivity: recentActivity.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      },
      { status: 500 }
    );
  }
}

