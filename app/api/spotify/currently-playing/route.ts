import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');

  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  // TODO: Implement Spotify currently playing
  return NextResponse.json({
    message: 'Spotify currently playing endpoint - coming soon',
    recordId,
    isPlaying: false,
    track: null,
  });
}
