import { NextRequest, NextResponse } from 'next/server';
import { updateUserOAuthTokens } from '@/lib/database';

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
    await updateUserOAuthTokens(recordId, {
      google: {
        accessToken: '',
        refreshToken: '',
        expiresAt: '',
      },
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




