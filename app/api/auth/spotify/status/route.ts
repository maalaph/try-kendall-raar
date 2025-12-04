import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

/**
 * GET /api/auth/spotify/status?recordId=recXXXX
 *
 * Returns Spotify integration status for a user:
 * {
 *   connected: boolean;
 *   userId: string | null;
 *   displayName: string | null;
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

    const connected = Boolean(fields['Spotify Connected']);
    const userId =
      (fields['Spotify User ID'] as string | undefined)?.trim() || null;
    const displayName =
      (fields['Spotify Display Name'] as string | undefined)?.trim() || null;
    const email =
      (fields['Spotify Email'] as string | undefined)?.trim() || null;

    return NextResponse.json({
      connected,
      userId,
      displayName,
      email,
    });
  } catch (error: any) {
    console.error('[SPOTIFY STATUS] Failed to fetch status:', {
      error: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch Spotify integration status',
        message: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}


