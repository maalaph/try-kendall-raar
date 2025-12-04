import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

/**
 * GET /api/auth/google/status?recordId=recXXXX
 *
 * Returns Google integration status for a user:
 * {
 *   calendarConnected: boolean;
 *   gmailConnected: boolean;
 *   email: string | null;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId query parameter is required' },
        { status: 400 },
      );
    }

    const userRecord = await getUserRecord(recordId);
    const fields = userRecord?.fields || {};

    const calendarConnected = Boolean(fields['Google Calendar Connected']);
    const gmailConnected = Boolean(fields['Google Gmail Connected']);
    const email =
      (fields['Google Email'] as string | undefined)?.trim() || null;

    return NextResponse.json({
      calendarConnected,
      gmailConnected,
      email,
    });
  } catch (error: any) {
    console.error('[GOOGLE STATUS] Failed to fetch status:', {
      error: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch Google integration status',
        message: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}


