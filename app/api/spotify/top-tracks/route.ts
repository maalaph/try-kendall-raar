import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const timeRange = searchParams.get('time_range') || 'medium_term';
  const limit = searchParams.get('limit') || '10';

  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  // TODO: Implement Spotify top tracks
  return NextResponse.json({
    message: 'Spotify top tracks endpoint - coming soon',
    recordId,
    timeRange,
    limit: parseInt(limit),
    tracks: [],
  });
}
