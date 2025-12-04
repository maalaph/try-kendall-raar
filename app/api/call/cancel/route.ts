import { NextRequest, NextResponse } from 'next/server';
import { cancelCall } from '@/lib/vapi';

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

export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json();
    
    if (!callId || typeof callId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'callId is required' },
        { status: 400 }
      );
    }

    // Race condition safety: Check current status first
    const currentCall = global.activeCalls[callId];
    if (currentCall && (currentCall.status === 'ended' || currentCall.status === 'failed')) {
      // Call already ended, just mark as cancelled in cache
      global.activeCalls[callId] = {
        ...currentCall,
        status: 'cancelled',
      };
      return NextResponse.json({
        success: true,
        message: 'Call was already ended, marked as cancelled',
      });
    }

    // Cancel the call via VAPI
    const result = await cancelCall(callId);
    
    if (result.success) {
      // Update in-memory cache
      if (global.activeCalls[callId]) {
        global.activeCalls[callId] = {
          ...global.activeCalls[callId],
          status: 'cancelled',
        };
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CALL CANCEL] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


