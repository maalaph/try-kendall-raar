import { getUserRecord } from '@/lib/airtable';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'recordId parameter is required' 
        },
        { status: 400 }
      );
    }

    const record = await getUserRecord(recordId);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error('[ERROR] getMyKendall failed:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch My Kendall record' 
      },
      { status: 500 }
    );
  }
}













