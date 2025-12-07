import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/database';
import { sanitizeRecordId } from '@/lib/utils';

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
    const rawRecordId = request.nextUrl.searchParams.get('recordId');

    if (!rawRecordId) {
      return NextResponse.json(
        { error: 'recordId query parameter is required' },
        { status: 400 },
      );
    }

    // Sanitize the recordId to remove any query string contamination
    const recordId = sanitizeRecordId(rawRecordId);
    if (!recordId) {
      return NextResponse.json(
        { 
          error: 'Invalid recordId format',
          message: `The recordId parameter has an invalid format. Expected format: rec[alphanumeric]`,
          received: rawRecordId.substring(0, 50), // Limit length for security
        },
        { status: 400 },
      );
    }

    const userRecord = await getUserRecord(recordId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (userRecord?.fields || {}) as any;

    // Check if Google tokens exist and are not expired
    const hasGoogleToken = Boolean(fields.googleAccessToken);
    const tokenExpiresAt = fields.googleTokenExpiresAt 
      ? new Date(fields.googleTokenExpiresAt) 
      : null;
    const isTokenValid = hasGoogleToken && (!tokenExpiresAt || tokenExpiresAt > new Date());

    // If tokens exist, both Calendar and Gmail are considered connected
    // (The same OAuth scope covers both)
    const calendarConnected = isTokenValid;
    const gmailConnected = isTokenValid;
    
    // Try to get email from the token or user record
    // Note: We might need to fetch this from Google API if not stored
    const email = fields.email || null;

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


