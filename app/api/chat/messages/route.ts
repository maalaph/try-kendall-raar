import { NextRequest, NextResponse } from 'next/server';
import { getChatMessages, getOrCreateThreadId, createChatMessage, getUserRecord } from '@/lib/airtable';

/**
 * GET /api/chat/messages
 * Get chat messages for a user with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const threadIdParam = searchParams.get('threadId');
    const lastMessageId = searchParams.get('lastMessageId');
    const limitParam = searchParams.get('limit');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Use provided threadId or get/create default threadId
    let threadId: string;
    try {
      if (threadIdParam) {
        threadId = threadIdParam;
      } else {
        threadId = await getOrCreateThreadId(recordId);
      }
    } catch (threadError) {
      console.error('[API ERROR] Failed to get or create threadId:', threadError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initialize chat thread',
          details: threadError instanceof Error ? threadError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
    
    // Parse limit (default: 50, max: 100)
    const limit = limitParam 
      ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100)
      : 50;

    // Get messages with error handling
    let result;
    try {
      result = await getChatMessages({
        threadId,
        lastMessageId: lastMessageId || undefined,
        limit,
      });
    } catch (messagesError) {
      const errorMessage = messagesError instanceof Error ? messagesError.message : 'Unknown error';
      
      // If Chat Messages table doesn't exist, return empty array instead of error
      if (errorMessage.includes('Chat Messages Airtable URL is not configured') ||
          errorMessage.includes('AIRTABLE_CHAT_MESSAGES_TABLE_ID')) {
        console.warn('[API WARNING] Chat Messages table not configured, returning empty messages:', errorMessage);
        return NextResponse.json({
          success: true,
          messages: [],
          hasMore: false,
          lastMessageId: undefined,
        });
      }
      
      // For other errors, return detailed error response
      console.error('[API ERROR] Failed to fetch chat messages:', messagesError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch chat messages',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: result.messages,
      hasMore: result.hasMore,
      lastMessageId: result.lastMessageId,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/messages failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat messages',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/messages
 * Send a message from user to agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, message, attachments } = body;

    if (!recordId || !message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'recordId and message are required' },
        { status: 400 }
      );
    }

    // Get user record to get agentId
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

    // Get or create threadId
    const threadId = await getOrCreateThreadId(recordId);

    // Create user message
    const userMessage = await createChatMessage({
      recordId,
      agentId: String(agentId),
      threadId,
      message: message.trim(),
      role: 'user',
      attachments: attachments || undefined,
    });

    return NextResponse.json({
      success: true,
      message: userMessage,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/messages failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      },
      { status: 500 }
    );
  }
}

