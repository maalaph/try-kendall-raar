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

    // Clear all Google OAuth fields
    await updateUserRecord(recordId, {
      'Google OAuth Access Token': '',
      'Google OAuth Refresh Token': '',
      'Google OAuth Token Expiry': '',
      'Google Calendar Connected': false,
      'Google Gmail Connected': false,
      'Google Email': '',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GOOGLE OAUTH] Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    );
  }
}

