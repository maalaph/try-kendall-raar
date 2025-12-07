/**
 * Search API Endpoint
 * Proxies to Mapbox Search Box API for autocomplete and POI search
 * Uses session-based billing for cost efficiency
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export interface SearchResult {
  id: string;
  name: string;
  full_address: string;
  category?: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  place_type?: string;
}

/**
 * GET /api/search
 * Search for places using Mapbox Search Box API
 * Query params: query, sessionId, latitude (optional), longitude (optional), limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const sessionId = searchParams.get('sessionId') || crypto.randomUUID();
    const latitude = parseFloat(searchParams.get('latitude') || '');
    const longitude = parseFloat(searchParams.get('longitude') || '');
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'query is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('[SEARCH] MAPBOX_ACCESS_TOKEN not configured');
      return NextResponse.json(
        { error: 'Search service not configured' },
        { status: 500 }
      );
    }

    // Check cache first
    if (userId) {
      const { data: cached } = await supabase
        .from('location_search_cache')
        .select('*')
        .eq('user_id', userId)
        .ilike('query', `%${query}%`)
        .gt('expires_at', new Date().toISOString())
        .order('hit_count', { ascending: false })
        .limit(5);

      if (cached && cached.length > 0) {
        console.log('[SEARCH] Partial cache hit for query:', query);
        // Update hit counts
        for (const item of cached) {
          await supabase
            .from('location_search_cache')
            .update({ 
              hit_count: (item.hit_count || 0) + 1,
              last_accessed_at: new Date().toISOString()
            })
            .eq('id', item.id);
        }
      }
    }

    // Call Mapbox Search Box API
    const mapboxUrl = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
    mapboxUrl.searchParams.set('q', query);
    mapboxUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    mapboxUrl.searchParams.set('session_token', sessionId);
    mapboxUrl.searchParams.set('language', 'en');
    mapboxUrl.searchParams.set('limit', Math.min(limit, 10).toString());

    // Add proximity if location available
    if (!isNaN(latitude) && !isNaN(longitude)) {
      mapboxUrl.searchParams.set('proximity', `${longitude},${latitude}`);
    }

    // Add types for POI search
    mapboxUrl.searchParams.set('types', 'poi,address,place');

    console.log('[SEARCH] Calling Mapbox Search Box API:', { query, sessionId });

    const response = await fetch(mapboxUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SEARCH] Mapbox API error:', response.status, errorText);
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Search service error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    const results: SearchResult[] = (data.suggestions || []).map((suggestion: any) => ({
      id: suggestion.mapbox_id || suggestion.id || crypto.randomUUID(),
      name: suggestion.name || '',
      full_address: suggestion.full_address || suggestion.place_formatted || '',
      category: suggestion.poi_category?.[0] || suggestion.feature_type || '',
      latitude: suggestion.geometry?.coordinates?.[1] || 0,
      longitude: suggestion.geometry?.coordinates?.[0] || 0,
      distance_meters: suggestion.distance,
      place_type: suggestion.feature_type || 'unknown',
    }));

    return NextResponse.json({
      success: true,
      results,
      session_id: sessionId,
      query,
    });
  } catch (error) {
    console.error('[API] GET /api/search error:', error);
    return NextResponse.json(
      { error: 'Failed to search', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search/retrieve
 * Retrieve full details for a search result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapbox_id, sessionId } = body;

    if (!mapbox_id) {
      return NextResponse.json(
        { error: 'mapbox_id is required' },
        { status: 400 }
      );
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Search service not configured' },
        { status: 500 }
      );
    }

    // Call Mapbox Retrieve API
    const mapboxUrl = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapbox_id}`);
    mapboxUrl.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    if (sessionId) {
      mapboxUrl.searchParams.set('session_token', sessionId);
    }

    const response = await fetch(mapboxUrl.toString());
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to retrieve place details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    const properties = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0];

    return NextResponse.json({
      success: true,
      result: {
        id: mapbox_id,
        name: properties.name || '',
        full_address: properties.full_address || '',
        category: properties.poi_category?.[0] || '',
        latitude: coords[1],
        longitude: coords[0],
        phone: properties.phone || '',
        website: properties.website || '',
        hours: properties.open_hours || null,
        rating: properties.rating || null,
      },
    });
  } catch (error) {
    console.error('[API] POST /api/search error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve place details' },
      { status: 500 }
    );
  }
}

