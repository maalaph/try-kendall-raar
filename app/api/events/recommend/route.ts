/**
 * Event Recommendation API
 * GET /api/events/recommend
 * Returns personalized event recommendations for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { recommendEvents, RecommendationOptions } from '@/lib/events/recommender';
import { recordImpression } from '@/lib/events/feedback';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const recordId = searchParams.get('recordId');
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Parse optional parameters
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const maxDistance = searchParams.get('maxDistance');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categories = searchParams.get('categories');
    const limit = searchParams.get('limit');
    const includeExplanations = searchParams.get('includeExplanations') === 'true';

    // Build recommendation options
    const options: RecommendationOptions = {
      recordId,
      limit: limit ? parseInt(limit) : 10,
      includeExplanations,
    };

    // Add location if provided
    if (latitude && longitude) {
      options.userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };

      if (maxDistance) {
        options.maxDistance = parseFloat(maxDistance);
      }
    }

    // Add time window if provided
    if (startDate || endDate) {
      options.timeWindow = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      };
    }

    // Add categories if provided
    if (categories) {
      options.categories = categories.split(',').map((c) => c.trim());
    }

    // Get recommendations
    const recommendations = await recommendEvents(options);

    // Record impressions for feedback loop
    for (const event of recommendations) {
      if (event.id) {
        try {
          await recordImpression({
            record_id: recordId,
            event_id: event.id,
            context: {
              source: 'api',
              timestamp: new Date().toISOString(),
              location: options.userLocation,
            },
          });
        } catch (error) {
          // Log but don't fail on impression recording
          console.warn('[EVENTS] Failed to record impression:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      recommendations: recommendations.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        start_date: typeof event.start_date === 'string' 
          ? event.start_date 
          : event.start_date.toISOString(),
        end_date: event.end_date 
          ? (typeof event.end_date === 'string' ? event.end_date : event.end_date.toISOString())
          : null,
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        venue: event.venue,
        price_min: event.price_min,
        price_max: event.price_max,
        currency: event.currency,
        url: event.url,
        image_url: event.image_url,
        score: event.score,
        scoreBreakdown: event.scoreBreakdown,
        explanation: event.explanation,
      })),
      count: recommendations.length,
    });
  } catch (error) {
    console.error('[EVENTS] Recommendation API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}



