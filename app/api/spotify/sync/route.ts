import { NextRequest, NextResponse } from 'next/server';
import { handleSyncRequest } from '@/lib/spotify/sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const recordId = body.recordId || request.nextUrl.searchParams.get('recordId') || undefined;

    const result = await handleSyncRequest(recordId);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error: any) {
    console.error('[SPOTIFY SYNC API] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}


