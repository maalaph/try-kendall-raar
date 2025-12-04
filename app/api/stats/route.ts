import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getCallStats, getRecentCallNotes, getUnreadCallNotes, getCallNotesByType } from '@/lib/airtable';

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

    // Get recent activity (last 10 call notes) - these are customer calls
    const recentActivity = await getRecentCallNotes(String(agentId), 10);

    // Get inbound calls (owner-assistant) and outbound calls (assistant-to-recipient)
    // Wrap in try-catch to handle cases where callType field doesn't exist or no calls yet
    let inboundCalls: any[] = [];
    let outboundCalls: any[] = [];
    
    try {
      inboundCalls = await getCallNotesByType(String(agentId), 'inbound', 20);
    } catch (error) {
      console.warn('[API ERROR] Failed to get inbound calls:', error);
      // Return empty array if callType field doesn't exist or other error
      inboundCalls = [];
    }
    
    try {
      outboundCalls = await getCallNotesByType(String(agentId), 'outbound', 20);
    } catch (error) {
      console.warn('[API ERROR] Failed to get outbound calls:', error);
      // Return empty array if callType field doesn't exist or other error
      outboundCalls = [];
    }

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
      inboundCalls: inboundCalls.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
      outboundCalls: outboundCalls.map(note => ({
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


