import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/google/api';

export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get optional query parameters
    const unread = request.nextUrl.searchParams.get('unread') === 'true';
    const maxResults = parseInt(request.nextUrl.searchParams.get('maxResults') || '10', 10);
    const labelIds = request.nextUrl.searchParams.get('labelIds')?.split(',') || [];

    // Get authenticated Gmail client
    const gmail = await getGmailClient(recordId);

    // Build query
    let query = '';
    if (unread) {
      query += 'is:unread ';
    }
    // Remove trailing space if query exists
    query = query.trim();

    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query || undefined,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
      maxResults,
    });

    const messages = response.data.messages || [];

    // Fetch full message details for each message
    const messageDetails = await Promise.all(
      messages.slice(0, maxResults).map(async (message) => {
        try {
          const messageData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const headers = messageData.data.payload?.headers || [];
          const getHeader = (name: string) => 
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id: message.id,
            threadId: message.threadId,
            snippet: messageData.data.snippet || '',
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            labelIds: messageData.data.labelIds || [],
          };
        } catch (error) {
          console.error(`[GOOGLE GMAIL] Error fetching message ${message.id}:`, error);
          return null;
        }
      })
    );

    // Filter out null results
    const validMessages = messageDetails.filter(msg => msg !== null);

    return NextResponse.json({
      success: true,
      messages: validMessages,
      count: validMessages.length,
    });
  } catch (error: any) {
    console.error('[GOOGLE GMAIL] Error fetching Gmail messages:', {
      error: error.message,
      stack: error.stack,
      recordId,
    });
    
    // Check for specific error types
    if (error.message?.includes('not connected') || error.message?.includes('Google account not connected')) {
      return NextResponse.json(
        { 
          error: 'Google account not connected',
          message: 'Please connect your Google account in the Integrations page.',
        },
        { status: 401 }
      );
    }
    
    // Check for token refresh errors
    if (error.message?.includes('Failed to refresh access token') || error.message?.includes('refresh token')) {
      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          message: 'Your Google account connection may have expired. Please reconnect your Google account in the Integrations page.',
        },
        { status: 401 }
      );
    }

    // Generic API error
    return NextResponse.json(
      { 
        error: 'Failed to fetch Gmail messages',
        message: error.message || 'Unknown error occurred while accessing Gmail',
      },
      { status: 500 }
    );
  }
}

