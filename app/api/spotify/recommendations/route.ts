import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const seedArtists = searchParams.get('seed_artists');
  const seedTracks = searchParams.get('seed_tracks');
  const limit = searchParams.get('limit') || '10';

  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  // TODO: Implement Spotify recommendations
  return NextResponse.json({
    message: 'Spotify recommendations endpoint - coming soon',
    recordId,
    seedArtists,
    seedTracks,
    limit: parseInt(limit),
    recommendations: [],
  });
}
