import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getChatMessages } from '@/lib/airtable';
import { getOrCreateThreadId } from '@/lib/airtable';

/**
 * GET /api/chat/search
 * Search across all conversations and messages
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    // Get user record
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Get threadId
    const threadId = await getOrCreateThreadId(recordId);

    // Get all messages (we'll need to paginate through all)
    const searchTerm = query.toLowerCase().trim();
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    
    // Fetch messages in batches to search (gracefully handle errors)
    let allMessages: Array<{
      id: string;
      message: string;
      role: 'user' | 'assistant';
      timestamp: string;
    }> = [];
    
    try {
      let lastMessageId: string | undefined;
      let hasMore = true;

      // Fetch messages until we have enough or run out
      while (hasMore && allMessages.length < 500) {
        try {
          const result = await getChatMessages({
            threadId,
            lastMessageId,
            limit: 100,
          });

          if (result.messages && result.messages.length > 0) {
            allMessages = [...allMessages, ...result.messages];
            lastMessageId = result.lastMessageId;
            hasMore = result.hasMore || false;
          } else {
            hasMore = false;
          }
        } catch (fetchError) {
          console.warn('[SEARCH] Error fetching messages batch:', fetchError);
          hasMore = false; // Stop trying to fetch more
        }
      }
    } catch (error) {
      console.warn('[SEARCH] Could not fetch messages (table may not exist):', error);
      // Continue with empty array - search will just return no results
    }

    // Search through messages
    const matchingMessages = allMessages
      .filter(msg => msg.message.toLowerCase().includes(searchTerm))
      .slice(0, limit)
      .map(msg => ({
        id: msg.id,
        message: msg.message,
        role: msg.role,
        timestamp: msg.timestamp,
        snippet: getSnippet(msg.message, searchTerm),
      }));

    return NextResponse.json({
      success: true,
      results: matchingMessages,
      totalFound: matchingMessages.length,
      query: searchTerm,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/search failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search',
      },
      { status: 500 }
    );
  }
}

/**
 * Get snippet of message with search term highlighted
 */
function getSnippet(message: string, searchTerm: string, contextLength: number = 50): string {
  const lowerMessage = message.toLowerCase();
  const index = lowerMessage.indexOf(searchTerm);
  
  if (index === -1) {
    return message.substring(0, 100) + (message.length > 100 ? '...' : '');
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(message.length, index + searchTerm.length + contextLength);
  
  let snippet = message.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < message.length) snippet = snippet + '...';
  
  return snippet;
}

