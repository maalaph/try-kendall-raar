import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    const userRecord = await getUserRecord(recordId);
    const fields = userRecord.fields;

    return NextResponse.json({
      calendarConnected: fields['Google Calendar Connected'] || false,
      gmailConnected: fields['Google Gmail Connected'] || false,
      email: fields['Google Email'] || null,
    });
  } catch (error) {
    console.error('[GOOGLE OAUTH] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}

