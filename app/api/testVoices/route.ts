import { NextResponse } from 'next/server';

/**
 * Test endpoint to check if VAPI has a /voices endpoint
 * This will help us understand the API structure for fetching available voices
 */
export async function GET() {
  try {
    const apiKey = process.env.VAPI_PRIVATE_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'VAPI_PRIVATE_KEY not found in environment variables',
          hint: 'Make sure your .env file has VAPI_PRIVATE_KEY set',
        },
        { status: 500 }
      );
    }

    console.log('[TEST] Attempting to fetch voices from VAPI API...');
    
    // Try the /voices endpoint first
    let response = await fetch('https://api.vapi.ai/voices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    let data;
    let rawText;
    
    try {
      data = await response.json();
    } catch (e) {
      // If JSON parsing fails, get raw text
      rawText = await response.text();
      data = { error: 'Response is not JSON', raw: rawText.substring(0, 500) };
    }

    // If /voices doesn't work, try alternative endpoints
    if (!response.ok || response.status === 404) {
      console.log('[TEST] /voices endpoint not found, trying alternatives...');
      
      // Try /voice-library
      response = await fetch('https://api.vapi.ai/voice-library', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      try {
        data = await response.json();
      } catch (e) {
        rawText = await response.text();
        data = { error: 'Response is not JSON', raw: rawText.substring(0, 500) };
      }
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      endpointsTested: [
        'https://api.vapi.ai/voices',
        'https://api.vapi.ai/voice-library',
      ],
      response: data,
      headers: {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
      },
      timestamp: new Date().toISOString(),
    }, { 
      status: response.ok ? 200 : response.status 
    });
  } catch (error) {
    console.error('[TEST ERROR]', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        hint: 'Check your VAPI_PRIVATE_KEY and network connection',
      },
      { status: 500 }
    );
  }
}
















