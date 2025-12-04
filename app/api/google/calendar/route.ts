import { NextRequest, NextResponse } from 'next/server';
import {
  fetchCalendarEvents,
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
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const maxResultsParam = searchParams.get('maxResults');

    const events = await fetchCalendarEvents(recordId, {
      timeMin: startDateParam ? new Date(startDateParam).toISOString() : undefined,
      timeMax: endDateParam ? new Date(endDateParam).toISOString() : undefined,
      maxResults: maxResultsParam
        ? Math.max(1, Math.min(50, Number(maxResultsParam)))
        : undefined,
    });

    return NextResponse.json({ success: true, events });
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

    console.error('[GOOGLE CALENDAR] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch calendar events',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while fetching calendar events',
      },
      { status: 500 },
    );
  }
}



