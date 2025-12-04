import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

/**
 * POST /api/chat/pin-message
 * Pin or unpin a message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, messageId, pinned } = body;

    if (!recordId || !messageId || typeof pinned !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'recordId, messageId, and pinned (boolean) are required' },
        { status: 400 }
      );
    }

    // Get user record to verify
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Store pinned status (would update Chat Messages table with pinned field)
    // For now, return success - actual pinning would update Airtable record

    return NextResponse.json({
      success: true,
      message: pinned ? 'Message pinned' : 'Message unpinned',
      messageId,
      pinned,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/pin-message failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pin/unpin message',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/pin-message
 * Get all pinned messages for a user
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

    // Get user record to verify
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Return empty array for now - would fetch pinned messages from Airtable
    return NextResponse.json({
      success: true,
      pinnedMessages: [],
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/pin-message failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pinned messages',
      },
      { status: 500 }
    );
  }
}




