/**
 * Event Feedback Loop System
 * Tracks impressions, interactions, and outcomes for learning
 */

import { supabase } from '@/lib/supabase';

export interface EventImpression {
  record_id: string;
  event_id: string;
  shown_at?: Date;
  context?: Record<string, any>;
}

export interface EventInteraction {
  impression_id: string;
  action: 'click' | 'save' | 'dismiss' | 'rsvp' | 'view_details';
  metadata?: Record<string, any>;
}

export interface EventOutcome {
  event_id: string;
  record_id: string;
  attended?: boolean;
  rating?: number;
  feedback?: string;
  verified_from_calendar?: boolean;
}

/**
 * Record event impression (when event is shown to user)
 */
export async function recordImpression(impression: EventImpression): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('event_impressions')
      .insert({
        record_id: impression.record_id,
        event_id: impression.event_id,
        shown_at: impression.shown_at?.toISOString() || new Date().toISOString(),
        context: impression.context || {},
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('[FEEDBACK] Failed to record impression:', error);
    throw error;
  }
}

/**
 * Record event interaction (user action on event)
 */
export async function recordInteraction(interaction: EventInteraction): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('event_interactions')
      .insert({
        impression_id: interaction.impression_id,
        action: interaction.action,
        metadata: interaction.metadata || {},
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('[FEEDBACK] Failed to record interaction:', error);
    throw error;
  }
}

/**
 * Record event outcome (did user attend?)
 */
export async function recordOutcome(outcome: EventOutcome): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('event_outcomes')
      .upsert(
        {
          event_id: outcome.event_id,
          record_id: outcome.record_id,
          attended: outcome.attended,
          rating: outcome.rating,
          feedback: outcome.feedback,
          verified_from_calendar: outcome.verified_from_calendar || false,
        },
        { onConflict: 'event_id,record_id' }
      )
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('[FEEDBACK] Failed to record outcome:', error);
    throw error;
  }
}

/**
 * Get user's event interaction history
 */
export async function getUserEventHistory(recordId: string, limit: number = 50): Promise<{
  impressions: Array<{
    id: string;
    event_id: string;
    shown_at: Date;
    interactions: Array<{
      action: string;
      timestamp: Date;
    }>;
  }>;
}> {
  try {
    // Get impressions
    const { data: impressions, error } = await supabase
      .from('event_impressions')
      .select('id, event_id, shown_at')
      .eq('record_id', recordId)
      .order('shown_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!impressions || impressions.length === 0) {
      return { impressions: [] };
    }

    const impressionIds = impressions.map((imp) => imp.id);

    // Get interactions for these impressions
    const { data: interactions } = await supabase
      .from('event_interactions')
      .select('impression_id, action, timestamp')
      .in('impression_id', impressionIds);

    // Group interactions by impression_id
    const interactionsByImpression = new Map<string, Array<{ action: string; timestamp: Date }>>();
    if (interactions) {
      for (const interaction of interactions) {
        if (!interactionsByImpression.has(interaction.impression_id)) {
          interactionsByImpression.set(interaction.impression_id, []);
        }
        interactionsByImpression.get(interaction.impression_id)!.push({
          action: interaction.action,
          timestamp: new Date(interaction.timestamp),
        });
      }
    }

    return {
      impressions: impressions.map((imp) => ({
        id: imp.id,
        event_id: imp.event_id,
        shown_at: new Date(imp.shown_at),
        interactions: interactionsByImpression.get(imp.id) || [],
      })),
    };
  } catch (error) {
    console.error('[FEEDBACK] Failed to get user history:', error);
    return { impressions: [] };
  }
}

/**
 * Check if user attended event (from calendar sync)
 */
export async function checkEventAttendance(
  recordId: string,
  eventId: string
): Promise<boolean | null> {
  try {
    const { data: outcome } = await supabase
      .from('event_outcomes')
      .select('attended, verified_from_calendar')
      .eq('event_id', eventId)
      .eq('record_id', recordId)
      .single();

    if (!outcome) return null;
    return outcome.verified_from_calendar ? outcome.attended : null;
  } catch (error) {
    return null;
  }
}

/**
 * Get positive/negative feedback signals for learning
 */
export async function getFeedbackSignals(recordId: string): Promise<{
  positiveEvents: string[]; // Event IDs user engaged with
  negativeEvents: string[]; // Event IDs user dismissed
}> {
  try {
    // Get impressions for this user
    const { data: impressions } = await supabase
      .from('event_impressions')
      .select('id, event_id')
      .eq('record_id', recordId);

    if (!impressions || impressions.length === 0) {
      return { positiveEvents: [], negativeEvents: [] };
    }

    const impressionIds = impressions.map((imp) => imp.id);

    // Get interactions for these impressions
    const { data: interactions } = await supabase
      .from('event_interactions')
      .select('impression_id, action')
      .in('impression_id', impressionIds);

    const positiveEvents: string[] = [];
    const negativeEvents: string[] = [];
    const impressionMap = new Map(impressions.map((imp) => [imp.id, imp.event_id]));

    if (interactions) {
      for (const interaction of interactions) {
        const eventId = impressionMap.get(interaction.impression_id);
        if (!eventId) continue;

        if (['click', 'save', 'rsvp'].includes(interaction.action)) {
          if (!positiveEvents.includes(eventId)) {
            positiveEvents.push(eventId);
          }
        }

        if (interaction.action === 'dismiss') {
          if (!negativeEvents.includes(eventId)) {
            negativeEvents.push(eventId);
          }
        }
      }
    }

    return { positiveEvents, negativeEvents };
  } catch (error) {
    console.error('[FEEDBACK] Failed to get feedback signals:', error);
    return { positiveEvents: [], negativeEvents: [] };
  }
}

