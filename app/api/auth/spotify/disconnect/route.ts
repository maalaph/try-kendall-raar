import { NextRequest, NextResponse } from 'next/server';
import { updateUserRecord } from '@/lib/airtable';

export async function POST(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Clear all Spotify OAuth fields
    await updateUserRecord(recordId, {
      'Spotify OAuth Access Token': '',
      'Spotify OAuth Refresh Token': '',
      'Spotify OAuth Token Expiry': '',
      'Spotify Connected': false,
      'Spotify User ID': '',
      'Spotify Display Name': '',
      'Spotify Email': '',
      'Spotify Listening Patterns': '',
      'Spotify Last Sync': '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SPOTIFY OAUTH] Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Spotify account' },
      { status: 500 }
    );
  }
}



