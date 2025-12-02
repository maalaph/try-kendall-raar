import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getRecentCallNotes, markCallNotesAsRead } from '@/lib/airtable';

/**
 * GET /api/call-notes
 * Get call notes for an agent and optionally mark them as read
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const limitParam = searchParams.get('limit');
    const markAsRead = searchParams.get('markAsRead') === 'true';

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

    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Get call notes
    const callNotes = await getRecentCallNotes(String(agentId), limit);

    // Mark as read if requested
    if (markAsRead && callNotes.length > 0) {
      const noteIds = callNotes.map(note => note.id);
      await markCallNotesAsRead(noteIds);
    }

    return NextResponse.json({
      success: true,
      notes: callNotes.map(note => ({
        id: note.id,
        callId: note.callId,
        callerPhone: note.callerPhone,
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/call-notes failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get call notes',
      },
      { status: 500 }
    );
  }
}

