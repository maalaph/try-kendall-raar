/**
 * Event Ingestion Pipeline
 * Syncs events from external sources (Google Events, Eventbrite, Meetup)
 */

import { upsertEvent, updateEventSourceStatus, getEventSourceConfig, Event } from './dataLayer';
import { getAuthenticatedGoogleClient } from '@/lib/google/api';

/**
 * Ingest events from Google Calendar public events
 * Uses Google Calendar API to search for public events
 */
export async function ingestGoogleEvents(
  recordId: string,
  options: {
    location?: { latitude: number; longitude: number };
    radius?: number; // in km
    startDate?: Date;
    endDate?: Date;
    maxResults?: number;
  } = {}
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const config = await getEventSourceConfig('google');
    if (!config || !config.enabled) {
      return { success: false, count: 0, error: 'Google Events source is disabled' };
    }

    // Check if user has Google OAuth
    let calendarClient;
    try {
      calendarClient = await getAuthenticatedGoogleClient(recordId);
    } catch (error) {
      await updateEventSourceStatus('google', {
        last_sync_at: new Date(),
        last_sync_status: 'error',
        last_sync_error: 'Google account not connected',
      });
      return { success: false, count: 0, error: 'Google account not connected' };
    }

    const now = new Date();
    const startDate = options.startDate || now;
    const endDate = options.endDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default: next 7 days
    const maxResults = options.maxResults || 100;

    let eventsFound = 0;

    // For Phase 1, we'll search for events in user's calendar that might be public events
    // In future, we can extend to search public event calendars or use Places API
    // For now, this is a placeholder that demonstrates the ingestion pattern

    // Search user's calendars for events
    const calendar = calendarClient;
    
    // Search primary calendar for events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: maxResults,
    });

    const googleEvents = response.data.items || [];
    
    // Filter and transform Google Calendar events to our Event format
    for (const googleEvent of googleEvents) {
      // Skip if it's not a public event (has location, description suggesting it's an external event)
      if (!googleEvent.start || !googleEvent.summary) continue;

      // Only process events with location (likely public events)
      if (!googleEvent.location) continue;

      try {
        // Parse Google Calendar event to our Event format
        const event: Event = {
          external_id: googleEvent.id || `google-${Date.now()}-${Math.random()}`,
          source: 'google',
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description || null,
          category: extractCategory(googleEvent),
          start_date: googleEvent.start?.dateTime || googleEvent.start?.date || startDate.toISOString(),
          end_date: googleEvent.end?.dateTime || googleEvent.end?.date || null,
          location: googleEvent.location || null,
          venue: extractVenue(googleEvent.location || ''),
          url: googleEvent.htmlLink || null,
          metadata: {
            google_event_id: googleEvent.id,
            creator: googleEvent.creator?.email,
            organizer: googleEvent.organizer?.email,
            attendees: googleEvent.attendees?.length || 0,
          },
        };

        // Try to geocode location if we have coordinates or can parse address
        if (googleEvent.location) {
          const coords = await geocodeLocation(googleEvent.location);
          if (coords) {
            event.latitude = coords.latitude;
            event.longitude = coords.longitude;
          }
        }

        await upsertEvent(event);
        eventsFound++;
      } catch (error) {
        console.error('[EVENTS] Failed to ingest Google event:', error);
        // Continue with next event
      }
    }

    await updateEventSourceStatus('google', {
      last_sync_at: new Date(),
      last_sync_status: eventsFound > 0 ? 'success' : 'partial',
      last_sync_error: null,
    });

    return { success: true, count: eventsFound };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[EVENTS] Google ingestion failed:', error);
    
    await updateEventSourceStatus('google', {
      last_sync_at: new Date(),
      last_sync_status: 'error',
      last_sync_error: errorMessage,
    });

    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Ingest events from Eventbrite (placeholder for future implementation)
 */
export async function ingestEventbriteEvents(
  options: {
    location?: { latitude: number; longitude: number };
    radius?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ success: boolean; count: number; error?: string }> {
  // TODO: Implement Eventbrite API integration
  // Eventbrite API: https://www.eventbrite.com/platform/api/
  // Requires: EVENTBRITE_API_KEY environment variable
  
  const config = await getEventSourceConfig('eventbrite');
  if (!config || !config.enabled) {
    return { success: false, count: 0, error: 'Eventbrite source is disabled' };
  }

  // Placeholder - will implement when API key is available
  return { success: false, count: 0, error: 'Eventbrite integration not yet implemented' };
}

/**
 * Ingest events from Meetup (placeholder for future implementation)
 */
export async function ingestMeetupEvents(
  options: {
    location?: { latitude: number; longitude: number };
    radius?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ success: boolean; count: number; error?: string }> {
  // TODO: Implement Meetup API integration
  // Meetup API: https://www.meetup.com/api/guide/
  // Requires: MEETUP_API_KEY environment variable
  
  const config = await getEventSourceConfig('meetup');
  if (!config || !config.enabled) {
    return { success: false, count: 0, error: 'Meetup source is disabled' };
  }

  // Placeholder - will implement when API key is available
  return { success: false, count: 0, error: 'Meetup integration not yet implemented' };
}

/**
 * Sync all enabled event sources
 */
export async function syncAllEventSources(recordId: string): Promise<{
  google?: { success: boolean; count: number };
  eventbrite?: { success: boolean; count: number };
  meetup?: { success: boolean; count: number };
}> {
  const results: any = {};

  // Sync Google Events
  const googleConfig = await getEventSourceConfig('google');
  if (googleConfig?.enabled) {
    results.google = await ingestGoogleEvents(recordId);
  }

  // Sync Eventbrite (when implemented)
  const eventbriteConfig = await getEventSourceConfig('eventbrite');
  if (eventbriteConfig?.enabled) {
    results.eventbrite = await ingestEventbriteEvents();
  }

  // Sync Meetup (when implemented)
  const meetupConfig = await getEventSourceConfig('meetup');
  if (meetupConfig?.enabled) {
    results.meetup = await ingestMeetupEvents();
  }

  return results;
}

/**
 * Helper: Extract category from Google Calendar event
 */
function extractCategory(googleEvent: any): string | null {
  // Try to infer category from description, summary, or location
  const text = [
    googleEvent.summary,
    googleEvent.description,
    googleEvent.location,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Simple category detection
  if (/concert|music|band|dj|festival|gig/.test(text)) return 'Music';
  if (/workshop|class|course|training|seminar/.test(text)) return 'Education';
  if (/sports|game|match|fitness|gym|workout/.test(text)) return 'Sports';
  if (/food|dining|restaurant|culinary|wine|beer/.test(text)) return 'Food & Drink';
  if (/art|gallery|exhibition|museum/.test(text)) return 'Arts';
  if (/tech|technology|startup|hackathon/.test(text)) return 'Technology';
  if (/networking|meetup|social/.test(text)) return 'Networking';
  if (/comedy|theater|theatre|show/.test(text)) return 'Entertainment';

  return null;
}

/**
 * Helper: Extract venue name from location string
 */
function extractVenue(location: string): string | null {
  // Simple venue extraction - take first part before comma
  const parts = location.split(',');
  return parts[0]?.trim() || null;
}

/**
 * Helper: Geocode location string to coordinates
 * Uses Mapbox Geocoding API if available, otherwise returns null
 */
async function geocodeLocation(location: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      return null;
    }

    const encodedLocation = encodeURIComponent(location);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&limit=1`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.warn('[EVENTS] Geocoding failed:', error);
    return null;
  }
}

