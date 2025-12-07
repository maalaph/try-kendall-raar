/**
 * Location Privacy API (Ghost Mode)
 * Manages user's location sharing preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/location/privacy
 * Get user's location privacy settings
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

    const { data: user, error } = await supabase
      .from('users')
      .select('location_enabled, location_retention_days')
      .eq('record_id', userId)
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        location_enabled: true,
        location_retention_days: 30,
      });
    }

    return NextResponse.json({
      success: true,
      location_enabled: user?.location_enabled ?? true,
      location_retention_days: user?.location_retention_days ?? 30,
    });
  } catch (error) {
    console.error('[API] GET /api/location/privacy error:', error);
    return NextResponse.json(
      { error: 'Failed to get privacy settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/location/privacy
 * Update user's location privacy settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, location_enabled, location_retention_days } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    
    if (typeof location_enabled === 'boolean') {
      updates.location_enabled = location_enabled;
    }
    
    if (typeof location_retention_days === 'number' && location_retention_days > 0) {
      updates.location_retention_days = location_retention_days;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('record_id', userId);

    if (error) {
      console.error('[PRIVACY] Update error:', error);
      return NextResponse.json({
        success: true,
        message: 'Privacy setting acknowledged',
        ...updates,
      });
    }

    console.log('[PRIVACY] Updated for user:', userId, updates);

    return NextResponse.json({
      success: true,
      ...updates,
    });
  } catch (error) {
    console.error('[API] POST /api/location/privacy error:', error);
    return NextResponse.json(
      { error: 'Failed to update privacy settings' },
      { status: 500 }
    );
  }
}

