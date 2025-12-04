import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getUnreadCallNotes } from '@/lib/airtable';

/**
 * GET /api/chat/messages-left
 * Get unread call notes/messages left for the agent
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

    // Get unread call notes
    const unreadNotes = await getUnreadCallNotes(String(agentId));

    return NextResponse.json({
      success: true,
      messages: unreadNotes,
      count: unreadNotes.length,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/messages-left failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get unread messages',
      },
      { status: 500 }
    );
  }
}



