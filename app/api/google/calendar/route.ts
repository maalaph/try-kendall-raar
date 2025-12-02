import { NextRequest, NextResponse } from 'next/server';
import { getCalendarClient } from '@/lib/google/api';

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
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    const maxResults = parseInt(request.nextUrl.searchParams.get('maxResults') || '10', 10);

    // Get authenticated Calendar client
    const calendar = await getCalendarClient(recordId);

    // Set up time range
    const timeMin = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
    const timeMax = endDate ? new Date(endDate).toISOString() : undefined;

    // Fetch events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Format events for easier consumption
    const formattedEvents = events.map(event => ({
      id: event.id,
      summary: event.summary || 'No title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date || null,
      end: event.end?.dateTime || event.end?.date || null,
      location: event.location || null,
      attendees: event.attendees?.map(a => ({
        email: a.email,
        displayName: a.displayName || a.email,
        responseStatus: a.responseStatus,
      })) || [],
      status: event.status,
      htmlLink: event.htmlLink || null,
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      count: formattedEvents.length,
    });
  } catch (error: any) {
    console.error('[GOOGLE CALENDAR] Error fetching calendar events:', {
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
        error: 'Failed to fetch calendar events',
        message: error.message || 'Unknown error occurred while accessing Google Calendar',
      },
      { status: 500 }
    );
  }
}

