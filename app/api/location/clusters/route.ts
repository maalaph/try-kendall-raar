/**
 * Location Clusters API
 * Manages user's learned location patterns (home, work, frequent places)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clusterUserLocations, getUserLearnedLocations } from '@/lib/location/clustering';

/**
 * GET /api/location/clusters
 * Get user's location clusters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

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
        clusters: [],
        message: 'Location sharing is disabled (Ghost Mode)',
      });
    }

    const result = await getUserLearnedLocations(userId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API] GET /api/location/clusters error:', error);
    return NextResponse.json(
      { error: 'Failed to get clusters', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/location/clusters
 * Trigger re-clustering of user's location data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eps, minPoints } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('[CLUSTERS] Triggering clustering for user:', userId);

    const result = await clusterUserLocations(
      userId,
      eps || 0.001,
      minPoints || 5
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[API] POST /api/location/clusters error:', error);
    return NextResponse.json(
      { error: 'Failed to cluster locations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

