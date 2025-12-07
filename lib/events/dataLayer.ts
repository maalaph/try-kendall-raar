/**
 * Event Data Layer
 * Handles event ingestion, storage, and retrieval from multiple sources
 */

import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Event {
  id?: string;
  external_id: string;
  source: 'google' | 'eventbrite' | 'meetup' | 'manual';
  title: string;
  description?: string | null;
  category?: string | null;
  start_date: Date | string;
  end_date?: Date | string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  venue?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string;
  url?: string | null;
  image_url?: string | null;
  metadata?: Record<string, any>;
  embedding?: number[] | null;
}

export interface EventSourceConfig {
  source: 'google' | 'eventbrite' | 'meetup';
  enabled: boolean;
  last_sync_at?: Date | null;
  last_sync_status?: 'success' | 'error' | 'partial' | null;
  last_sync_error?: string | null;
  sync_config?: Record<string, any>;
}

/**
 * Generate embedding for event using OpenAI
 */
async function generateEventEmbedding(event: Event): Promise<number[] | null> {
  try {
    // Create text representation of event for embedding
    const eventText = [
      event.title,
      event.description || '',
      event.category || '',
      event.venue || '',
      event.location || '',
    ]
      .filter(Boolean)
      .join(' ');

    if (!eventText.trim()) {
      console.warn('[EVENTS] Empty event text, skipping embedding');
      return null;
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: eventText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[EVENTS] Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Upsert event to database
 */
export async function upsertEvent(event: Event): Promise<string> {
  try {
    // Generate embedding if not provided
    let embedding = event.embedding;
    if (!embedding && (event.title || event.description)) {
      embedding = await generateEventEmbedding(event);
    }

    // Prepare event data for database
    const eventData: any = {
      external_id: event.external_id,
      source: event.source,
      title: event.title,
      description: event.description || null,
      category: event.category || null,
      start_date: typeof event.start_date === 'string' 
        ? event.start_date 
        : event.start_date.toISOString(),
      end_date: event.end_date 
        ? (typeof event.end_date === 'string' ? event.end_date : event.end_date.toISOString())
        : null,
      location: event.location || null,
      latitude: event.latitude || null,
      longitude: event.longitude || null,
      venue: event.venue || null,
      price_min: event.price_min || null,
      price_max: event.price_max || null,
      currency: event.currency || 'USD',
      url: event.url || null,
      image_url: event.image_url || null,
      metadata: event.metadata || {},
      embedding: embedding ? JSON.stringify(embedding) : null,
    };

    // Check if event exists
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('external_id', event.external_id)
      .eq('source', event.source)
      .single();

    if (existing) {
      // Update existing event
      const { data, error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Insert new event
      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    console.error('[EVENTS] Failed to upsert event:', error);
    throw error;
  }
}

/**
 * Get events by filters
 */
export async function getEvents(filters: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
}): Promise<Event[]> {
  try {
    let query = supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('start_date', filters.endDate.toISOString());
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.latitude && filters.longitude && filters.radiusKm) {
      // Use PostGIS distance if available, otherwise filter in memory
      // For now, we'll use a simple bounding box approximation
      const radiusDegrees = filters.radiusKm / 111.0; // Rough conversion
      query = query
        .gte('latitude', filters.latitude - radiusDegrees)
        .lte('latitude', filters.latitude + radiusDegrees)
        .gte('longitude', filters.longitude - radiusDegrees)
        .lte('longitude', filters.longitude + radiusDegrees);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by exact radius if PostGIS isn't available
    if (filters.latitude && filters.longitude && filters.radiusKm && data) {
      const filtered = data.filter((event) => {
        if (!event.latitude || !event.longitude) return false;
        const distance = calculateDistance(
          filters.latitude!,
          filters.longitude!,
          event.latitude,
          event.longitude
        );
        return distance <= filters.radiusKm!;
      });
      return filtered.map(transformDbEvent);
    }

    return (data || []).map(transformDbEvent);
  } catch (error) {
    console.error('[EVENTS] Failed to get events:', error);
    throw error;
  }
}

/**
 * Get event by ID
 */
export async function getEventById(eventId: string): Promise<Event | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? transformDbEvent(data) : null;
  } catch (error) {
    console.error('[EVENTS] Failed to get event by ID:', error);
    throw error;
  }
}

/**
 * Update event source sync status
 */
export async function updateEventSourceStatus(
  source: 'google' | 'eventbrite' | 'meetup',
  status: {
    last_sync_at?: Date;
    last_sync_status?: 'success' | 'error' | 'partial';
    last_sync_error?: string | null;
  }
): Promise<void> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status.last_sync_at) {
      updateData.last_sync_at = status.last_sync_at.toISOString();
    }

    if (status.last_sync_status) {
      updateData.last_sync_status = status.last_sync_status;
    }

    if (status.last_sync_error !== undefined) {
      updateData.last_sync_error = status.last_sync_error;
    }

    const { error } = await supabase
      .from('event_sources')
      .upsert(
        {
          source,
          ...updateData,
        },
        { onConflict: 'source' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('[EVENTS] Failed to update source status:', error);
    throw error;
  }
}

/**
 * Get event source configuration
 */
export async function getEventSourceConfig(
  source: 'google' | 'eventbrite' | 'meetup'
): Promise<EventSourceConfig | null> {
  try {
    const { data, error } = await supabase
      .from('event_sources')
      .select('*')
      .eq('source', source)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? {
      source: data.source,
      enabled: data.enabled ?? true,
      last_sync_at: data.last_sync_at ? new Date(data.last_sync_at) : null,
      last_sync_status: data.last_sync_status,
      last_sync_error: data.last_sync_error,
      sync_config: data.sync_config || {},
    } : null;
  } catch (error) {
    console.error('[EVENTS] Failed to get source config:', error);
    return null;
  }
}

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Helper: Transform database event to Event interface
 */
function transformDbEvent(dbEvent: any): Event {
  return {
    id: dbEvent.id,
    external_id: dbEvent.external_id,
    source: dbEvent.source,
    title: dbEvent.title,
    description: dbEvent.description,
    category: dbEvent.category,
    start_date: new Date(dbEvent.start_date),
    end_date: dbEvent.end_date ? new Date(dbEvent.end_date) : null,
    location: dbEvent.location,
    latitude: dbEvent.latitude ? parseFloat(dbEvent.latitude) : null,
    longitude: dbEvent.longitude ? parseFloat(dbEvent.longitude) : null,
    venue: dbEvent.venue,
    price_min: dbEvent.price_min ? parseFloat(dbEvent.price_min) : null,
    price_max: dbEvent.price_max ? parseFloat(dbEvent.price_max) : null,
    currency: dbEvent.currency || 'USD',
    url: dbEvent.url,
    image_url: dbEvent.image_url,
    metadata: dbEvent.metadata || {},
    embedding: dbEvent.embedding ? JSON.parse(dbEvent.embedding) : null,
  };
}

