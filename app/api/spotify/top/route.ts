import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSpotifyInsights,
  SpotifyIntegrationError,
  SpotifyTopOptions,
} from '@/lib/integrations/spotify';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const recordId = searchParams.get('recordId');

  if (!recordId) {
    return NextResponse.json(
      { success: false, error: 'recordId parameter is required' },
      { status: 400 },
    );
  }

  const timeRangeParam = searchParams.get('timeRange');
  const limitParam = searchParams.get('limit');

  const options: SpotifyTopOptions = {};
  if (
    timeRangeParam &&
    ['short_term', 'medium_term', 'long_term'].includes(timeRangeParam)
  ) {
    options.timeRange = timeRangeParam as SpotifyTopOptions['timeRange'];
  }
  if (limitParam) {
    const parsedLimit = Number(limitParam);
    if (!Number.isNaN(parsedLimit)) {
      options.limit = Math.max(1, Math.min(20, parsedLimit));
    }
  }

  try {
    const insights = await fetchSpotifyInsights(recordId, options);
    return NextResponse.json({
      success: true,
      insights,
    });
  } catch (error) {
    if (error instanceof SpotifyIntegrationError) {
      const status =
        error.reason === 'NOT_CONNECTED' || error.reason === 'TOKEN_REFRESH_FAILED'
          ? 401
          : 500;
      const message =
        error.reason === 'NOT_CONNECTED'
          ? 'Please connect your Spotify account in the Integrations page.'
          : error.reason === 'TOKEN_REFRESH_FAILED'
          ? 'Your Spotify connection may have expired. Please reconnect it in the Integrations page.'
          : error.message;

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          message,
        },
        { status },
      );
    }

    console.error('[SPOTIFY TOP] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Spotify data',
        message:
          error instanceof Error ? error.message : 'Unknown Spotify error',
      },
      { status: 500 },
    );
  }
}


