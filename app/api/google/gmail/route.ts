import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGmailMessages,
  GoogleIntegrationError,
} from '@/lib/integrations/google';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const recordId = searchParams.get('recordId');

  if (!recordId) {
    return NextResponse.json(
      { success: false, error: 'recordId parameter is required' },
      { status: 400 },
    );
  }

  try {
    const unreadParam = searchParams.get('unread');
    const unread =
      typeof unreadParam === 'string'
        ? unreadParam.toLowerCase() === 'true'
        : false;

    const maxResultsParam = searchParams.get('maxResults');
    const maxResults = maxResultsParam
      ? Math.max(1, Math.min(20, Number(maxResultsParam)))
      : 10;

    const messages = await fetchGmailMessages(recordId, {
      unread,
      maxResults,
    });

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    if (error instanceof GoogleIntegrationError) {
      const status =
        error.reason === 'NOT_CONNECTED' || error.reason === 'TOKEN_REFRESH_FAILED'
          ? 401
          : 500;
      const message =
        error.reason === 'NOT_CONNECTED'
          ? 'Please connect your Google account in the Integrations page.'
          : error.reason === 'TOKEN_REFRESH_FAILED'
          ? 'Your Google account connection may have expired. Please reconnect your Google account in the Integrations page.'
          : error.message;

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          message,
        },
        { status },
      );
    }

    console.error('[GOOGLE GMAIL] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Gmail messages',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while fetching Gmail messages',
      },
      { status: 500 },
    );
  }
}



