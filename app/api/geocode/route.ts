/**
 * Geocoding API Endpoint
 * Proxies to Mapbox Geocoding API for reverse geocoding (coordinates → address)
 * Supports hybrid model: temporary (exploration) vs permanent (saves)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export interface GeocodeResult {
  formatted_address: string;
  place_name: string;
  locality?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  neighborhood?: string;
  latitude: number;
  longitude: number;
  accuracy?: string;
  place_type?: string[];
}

/**
 * GET /api/geocode
 * Reverse geocode coordinates to address
 * Query params: latitude, longitude, permanent (optional, default false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('latitude') || '');
    const longitude = parseFloat(searchParams.get('longitude') || '');
    const permanent = searchParams.get('permanent') === 'true';
    const userId = searchParams.get('userId');

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'latitude and longitude are required and must be valid numbers' },
        { status: 400 }
      );
    }

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

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('[GEOCODE] MAPBOX_ACCESS_TOKEN not configured');
      return NextResponse.json(
        { error: 'Geocoding service not configured' },
        { status: 500 }
      );
    }

    // Check cache first (if userId provided)
    if (userId) {
      const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const { data: cached } = await supabase
        .from('location_search_cache')
        .select('*')
        .eq('user_id', userId)
        .eq('query', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached?.result_json) {
        // Update hit count
        await supabase
          .from('location_search_cache')
          .update({ 
            hit_count: (cached.hit_count || 0) + 1,
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', cached.id);

        console.log('[GEOCODE] Cache hit for', cacheKey);
        return NextResponse.json({
          success: true,
          result: cached.result_json as GeocodeResult,
          cached: true,
        });
      }
    }

    // Call Mapbox Geocoding API v6
    const mapboxUrl = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
    mapboxUrl.searchParams.set('longitude', longitude.toString());
    mapboxUrl.searchParams.set('latitude', latitude.toString());
    mapboxUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    mapboxUrl.searchParams.set('language', 'en');
    
    // For permanent geocoding, we can request more detail
    if (permanent) {
      mapboxUrl.searchParams.set('types', 'address,place,locality,neighborhood');
    }

    console.log('[GEOCODE] Calling Mapbox API:', { latitude, longitude, permanent });

    const response = await fetch(mapboxUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GEOCODE] Mapbox API error:', response.status, errorText);
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Geocoding service error', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return NextResponse.json({
        success: true,
        result: {
          formatted_address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          place_name: 'Unknown location',
          latitude,
          longitude,
        } as GeocodeResult,
        cached: false,
      });
    }

    const feature = data.features[0];
    const properties = feature.properties || {};
    const context = properties.context || {};

    // Extract address components
    const result: GeocodeResult = {
      formatted_address: properties.full_address || properties.name || feature.place_name || '',
      place_name: properties.name || '',
      locality: context.locality?.name || context.place?.name || '',
      region: context.region?.name || '',
      country: context.country?.name || '',
      postal_code: context.postcode?.name || '',
      neighborhood: context.neighborhood?.name || '',
      latitude,
      longitude,
      accuracy: properties.accuracy || 'unknown',
      place_type: feature.properties?.feature_type ? [feature.properties.feature_type] : [],
    };

    // Cache the result (if userId provided and permanent)
    if (userId && permanent) {
      const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      await supabase
        .from('location_search_cache')
        .upsert({
          user_id: userId,
          query: cacheKey,
          result_json: result,
          latitude,
          longitude,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        }, {
          onConflict: 'user_id,query',
        });
    }

    console.log('[GEOCODE] Success:', result.formatted_address);

    return NextResponse.json({
      success: true,
      result,
      cached: false,
      geocoding_type: permanent ? 'permanent' : 'temporary',
    });
  } catch (error) {
    console.error('[API] GET /api/geocode error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode location', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/geocode
 * Forward geocode address to coordinates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('[GEOCODE] MAPBOX_ACCESS_TOKEN not configured');
      return NextResponse.json(
        { error: 'Geocoding service not configured' },
        { status: 500 }
      );
    }

    // Check cache first
    if (userId) {
      const { data: cached } = await supabase
        .from('location_search_cache')
        .select('*')
        .eq('user_id', userId)
        .ilike('query', query)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached?.result_json) {
        await supabase
          .from('location_search_cache')
          .update({ 
            hit_count: (cached.hit_count || 0) + 1,
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', cached.id);

        return NextResponse.json({
          success: true,
          result: cached.result_json,
          cached: true,
        });
      }
    }

    // Call Mapbox Geocoding API v6 for forward geocoding
    const mapboxUrl = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    mapboxUrl.searchParams.set('q', query);
    mapboxUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    mapboxUrl.searchParams.set('language', 'en');
    mapboxUrl.searchParams.set('limit', '5');

    const response = await fetch(mapboxUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GEOCODE] Mapbox API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Geocoding service error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    const results: GeocodeResult[] = (data.features || []).map((feature: any) => {
      const properties = feature.properties || {};
      const context = properties.context || {};
      const coords = feature.geometry?.coordinates || [0, 0];
      
      return {
        formatted_address: properties.full_address || properties.name || '',
        place_name: properties.name || '',
        locality: context.locality?.name || context.place?.name || '',
        region: context.region?.name || '',
        country: context.country?.name || '',
        postal_code: context.postcode?.name || '',
        neighborhood: context.neighborhood?.name || '',
        longitude: coords[0],
        latitude: coords[1],
        accuracy: properties.accuracy || 'unknown',
        place_type: feature.properties?.feature_type ? [feature.properties.feature_type] : [],
      };
    });

    return NextResponse.json({
      success: true,
      results,
      cached: false,
    });
  } catch (error) {
    console.error('[API] POST /api/geocode error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode address', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

