import { NextRequest, NextResponse } from 'next/server';

/**
 * Create a permanent voice from a generated voice preview
 * This converts a generated_voice_id from Voice Design API into a permanent voice_id
 */
export async function POST(request: NextRequest) {
  try {
    const { generatedVoiceId, voiceName, voiceDescription } = await request.json();

    if (!generatedVoiceId || typeof generatedVoiceId !== 'string') {
      return NextResponse.json(
        { error: 'generatedVoiceId is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    // ElevenLabs Create Voice from Preview API endpoint
    // Endpoint: /v1/text-to-voice/create
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/create', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          generated_voice_id: generatedVoiceId,
          voice_name: voiceName || 'Custom Generated Voice',
          voice_description: voiceDescription || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if it's a plan limitation
        if (response.status === 403 || response.status === 402) {
          return NextResponse.json(
            {
              error: 'Voice creation requires a paid plan (Starter or higher)',
              details: errorData,
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          {
            error: 'Failed to create voice',
            details: errorData,
            status: response.status,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      // The API returns the created voice with a permanent voice_id
      return NextResponse.json({
        success: true,
        voiceId: data.voice_id,
        voiceName: data.voice_name || voiceName,
        voice: data,
      });
    } catch (error) {
      console.error('[ERROR] Create Voice API call failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to create voice',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[ERROR] createVoiceFromPreview failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create voice',
      },
      { status: 500 }
    );
  }
}












