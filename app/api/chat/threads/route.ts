import { NextRequest, NextResponse } from 'next/server';
import { getAllChatThreads, createNewThread, getUserRecord, createChatMessage } from '@/lib/airtable';

/**
 * GET /api/chat/threads
 * Get all chat threads for a user
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

    // Verify user record exists
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Get all threads for this user
    const threads = await getAllChatThreads(recordId);

    return NextResponse.json({
      success: true,
      threads,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/threads failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat threads',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/threads
 * Create a new chat thread
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Verify user record exists
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Create new thread
    const threadId = await createNewThread(recordId);

    // Create an initial placeholder message so the thread appears in the sidebar immediately
    // This ensures the thread is visible even before the user sends their first message
    try {
      const agentId = userRecord.fields.vapi_agent_id as string | undefined;
      if (agentId) {
        await createChatMessage({
          recordId,
          agentId: String(agentId),
          threadId,
          message: 'Chat started',
          role: 'assistant', // Use 'assistant' instead of 'system' to avoid select field issues
          messageType: 'text', // Use 'text' instead of 'system' since 'system' isn't an allowed option
        });
        console.log('[API] Created initial placeholder message for thread:', threadId);
      } else {
        console.warn('[API] No agentId found, skipping placeholder message creation');
      }
    } catch (messageError) {
      // Log but don't fail - thread creation succeeded even if placeholder message fails
      console.error('[API] Failed to create placeholder message (thread still created):', messageError);
    }

    return NextResponse.json({
      success: true,
      threadId,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/threads failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat thread',
      },
      { status: 500 }
    );
  }
}

