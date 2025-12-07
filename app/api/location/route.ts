/**
 * Location API Endpoint
 * Stores and retrieves user location data
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface LocationData {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  label?: string;
  source?: 'browser' | 'manual' | 'gps' | 'ip' | 'other';
}

export interface SavedLocation {
  userId: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * GET /api/location
 * Get user's location history or saved locations
 * Query params: userId, type (history|saved|last), limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'history';
    const limit = parseInt(searchParams.get('limit') || '10');
    const label = searchParams.get('label');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Get last known location
    if (type === 'last') {
      const { data, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return NextResponse.json({
        location: data ? {
          id: data.id,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          altitude: data.altitude,
          heading: data.heading,
          speed: data.speed,
          label: data.label,
          source: data.source,
          createdAt: data.created_at,
        } : null,
      });
    }
    
    // Get saved locations (home, work, etc.)
    if (type === 'saved') {
      let query = supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', userId);
      
      if (label) {
        query = query.eq('label', label);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return NextResponse.json({
        locations: (data || []).map(loc => ({
          id: loc.id,
          label: loc.label,
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
          createdAt: loc.created_at,
        })),
      });
    }
    
    // Get location history (default)
    const { data, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return NextResponse.json({
      locations: (data || []).map(loc => ({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        altitude: loc.altitude,
        heading: loc.heading,
        speed: loc.speed,
        label: loc.label,
        source: loc.source,
        createdAt: loc.created_at,
      })),
    });
  } catch (error) {
    console.error('[API] GET /api/location error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/location
 * Save a new location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userId,
      latitude,
      longitude,
      accuracy,
      altitude,
      altitudeAccuracy,
      heading,
      speed,
      label,
      source = 'browser',
    } = body as LocationData;
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude are required and must be numbers' },
        { status: 400 }
      );
    }
    
    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'latitude must be between -90 and 90' },
        { status: 400 }
      );
    }
    
    if (longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'longitude must be between -180 and 180' },
        { status: 400 }
      );
    }
    
    // Insert location
    const { data, error } = await supabase
      .from('user_locations')
      .insert({
        user_id: userId,
        latitude,
        longitude,
        accuracy,
        altitude,
        altitude_accuracy: altitudeAccuracy,
        heading,
        speed,
        label,
        source,
      })
      .select('*')
      .single();
    
    if (error) throw error;
    
    console.log('[LOCATION] Saved location:', {
      userId,
      latitude,
      longitude,
      label,
    });
    
    return NextResponse.json({
      success: true,
      location: {
        id: data.id,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        label: data.label,
        source: data.source,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('[API] POST /api/location error:', error);
    return NextResponse.json(
      { error: 'Failed to save location', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/location
 * Save or update a named location (home, work, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { userId, label, latitude, longitude, address } = body as SavedLocation;
    
    // Validate required fields
    if (!userId || !label) {
      return NextResponse.json(
        { error: 'userId and label are required' },
        { status: 400 }
      );
    }
    
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude are required and must be numbers' },
        { status: 400 }
      );
    }
    
    // Upsert saved location (unique on user_id + label)
    const { data, error } = await supabase
      .from('saved_locations')
      .upsert(
        {
          user_id: userId,
          label,
          latitude,
          longitude,
          address,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,label',
        }
      )
      .select('*')
      .single();
    
    if (error) throw error;
    
    console.log('[LOCATION] Saved named location:', {
      userId,
      label,
      latitude,
      longitude,
    });
    
    return NextResponse.json({
      success: true,
      location: {
        id: data.id,
        label: data.label,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('[API] PUT /api/location error:', error);
    return NextResponse.json(
      { error: 'Failed to save location', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/location
 * Delete a saved location
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const label = searchParams.get('label');
    const locationId = searchParams.get('id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Delete by ID
    if (locationId) {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', locationId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }
    
    // Delete by label
    if (label) {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('user_id', userId)
        .eq('label', label);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { error: 'Either id or label is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] DELETE /api/location error:', error);
    return NextResponse.json(
      { error: 'Failed to delete location', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

