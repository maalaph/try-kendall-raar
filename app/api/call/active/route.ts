import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for active calls (can be replaced with KV later)
declare global {
  var activeCalls: Record<string, {
    status: 'ringing' | 'in-progress' | 'ended' | 'cancelled' | 'failed';
    startTime: number;
    phoneNumber: string;
    contactName?: string;
    recordId: string;
    threadId?: string;
  }> | undefined;
}

global.activeCalls = global.activeCalls || {};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const threadId = searchParams.get('threadId');
    
    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId query parameter is required' },
        { status: 400 }
      );
    }

    // Find active calls for this recordId/threadId
    const activeCalls = global.activeCalls || {};
    const matchingCalls = Object.entries(activeCalls)
      .filter(([callId, call]) => {
        if (call.recordId !== recordId) return false;
        if (threadId && call.threadId !== threadId) return false;
        // Only return calls that are still active
        return call.status === 'ringing' || call.status === 'in-progress';
      })
      .map(([callId, call]) => ({
        callId,
        ...call,
      }))
      .sort((a, b) => b.startTime - a.startTime); // Most recent first

    if (matchingCalls.length === 0) {
      return NextResponse.json({
        success: true,
        activeCall: null,
      });
    }

    // Return the most recent active call
    const mostRecent = matchingCalls[0];
    
    return NextResponse.json({
      success: true,
      activeCall: {
        callId: mostRecent.callId,
        status: mostRecent.status,
        startTime: new Date(mostRecent.startTime).toISOString(),
        phoneNumber: mostRecent.phoneNumber,
        contactName: mostRecent.contactName,
      },
    });
  } catch (error) {
    console.error('[CALL ACTIVE] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST endpoint to write active call to cache
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callId, recordId, threadId, status, phoneNumber, contactName } = body;
    
    if (!callId || !recordId || !status || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'callId, recordId, status, and phoneNumber are required' },
        { status: 400 }
      );
    }

    global.activeCalls = global.activeCalls || {};
    global.activeCalls[callId] = {
      status: status as 'ringing' | 'in-progress' | 'ended' | 'cancelled' | 'failed',
      startTime: Date.now(),
      phoneNumber,
      contactName,
      recordId,
      threadId,
    };

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CALL ACTIVE] POST Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

