import { NextRequest, NextResponse } from 'next/server';

const VAPI_API_URL = 'https://api.vapi.ai';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    
    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'callId query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VAPI_PRIVATE_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'VAPI_PRIVATE_KEY not configured' },
        { status: 500 }
      );
    }

    // Direct VAPI call - simple and reliable
    const response = await fetch(`${VAPI_API_URL}/call/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.message || `Failed to fetch call status: ${response.status}` 
        },
        { status: response.status }
      );
    }

    const callData = await response.json();
    
    // Map VAPI statuses to our internal statuses
    const mapVapiStatus = (vapiStatus: string): 'ringing' | 'in-progress' | 'ended' | 'cancelled' | 'failed' => {
      const status = vapiStatus?.toLowerCase();
      if (status === 'queued' || status === 'ringing') return 'ringing';
      if (status === 'in-progress' || status === 'inprogress' || status === 'answered') return 'in-progress';
      if (status === 'ended' || status === 'completed') return 'ended';
      if (status === 'cancelled' || status === 'canceled') return 'cancelled';
      if (status === 'failed' || status === 'busy' || status === 'no-answer') return 'failed';
      return 'ringing'; // Default to ringing for unknown statuses
    };
    
    // Extract relevant fields
    return NextResponse.json({
      success: true,
      callId: callData.id || callId,
      status: mapVapiStatus(callData.status || 'unknown'),
      phoneNumber: callData.customer?.number || callData.phoneNumber,
      duration: callData.duration, // Only reliable after call ends
      createdAt: callData.createdAt,
      endedAt: callData.endedAt,
    });
  } catch (error) {
    console.error('[CALL STATUS] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

