/**
 * Location Suggestions API
 * Manages proactive location suggestions based on clustering patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface LocationSuggestion {
  id: string;
  userId: string;
  clusterId: number;
  suggestedLabel?: string;
  address?: string;
  latitude: number;
  longitude: number;
  confidenceScore: number;
  visitCount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
  createdAt: string;
  respondedAt?: string;
}

/**
 * GET /api/location/suggestions
 * Get pending suggestions for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'pending';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if location is enabled (Ghost Mode)
    const { data: user } = await supabase
      .from('users')
      .select('location_enabled')
      .eq('record_id', userId)
      .single();

    if (user && user.location_enabled === false) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'Location sharing is disabled (Ghost Mode)',
      });
    }

    let query = supabase
      .from('location_suggestions')
      .select('*')
      .eq('user_id', userId);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('confidence_score', { ascending: false });

    if (error) throw error;

    const suggestions: LocationSuggestion[] = (data || []).map((s: any) => ({
      id: s.id,
      userId: s.user_id,
      clusterId: s.cluster_id,
      suggestedLabel: s.suggested_label,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      confidenceScore: s.confidence_score,
      visitCount: s.visit_count,
      status: s.status,
      createdAt: s.created_at,
      respondedAt: s.responded_at,
    }));

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('[API] GET /api/location/suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/location/suggestions
 * Accept or reject a suggestion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestionId, userId, action, customLabel } = body;

    if (!suggestionId || !userId || !action) {
      return NextResponse.json(
        { error: 'suggestionId, userId, and action are required' },
        { status: 400 }
      );
    }

    if (!['accept', 'reject', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be accept, reject, or dismiss' },
        { status: 400 }
      );
    }

    // Get the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('location_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    if (suggestion.status !== 'pending') {
      return NextResponse.json(
        { error: 'Suggestion has already been responded to' },
        { status: 400 }
      );
    }

    const newStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'dismissed';
    const finalLabel = customLabel || suggestion.suggested_label || 'Custom Location';

    // Update suggestion status
    const { error: updateError } = await supabase
      .from('location_suggestions')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
        suggested_label: finalLabel, // Update with user's custom label if provided
      })
      .eq('id', suggestionId);

    if (updateError) throw updateError;

    // If accepted, save to saved_locations
    if (action === 'accept') {
      const { error: saveError } = await supabase
        .from('saved_locations')
        .upsert(
          {
            user_id: userId,
            label: finalLabel,
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            address: suggestion.address,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,label',
          }
        );

      if (saveError) {
        console.error('[SUGGESTIONS] Failed to save location:', saveError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: `Suggestion ${action}ed successfully`,
    });
  } catch (error) {
    console.error('[API] POST /api/location/suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/location/suggestions
 * Delete a suggestion (admin/cleanup)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const suggestionId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!suggestionId || !userId) {
      return NextResponse.json(
        { error: 'id and userId are required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('location_suggestions')
      .delete()
      .eq('id', suggestionId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] DELETE /api/location/suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to delete suggestion', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



