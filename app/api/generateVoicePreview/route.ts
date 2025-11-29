import { NextRequest, NextResponse } from 'next/server';
import { getOptimalVoiceSettings } from '@/lib/voiceSettingsOptimizer';
import { enhanceVoiceDescription } from '@/lib/enhanceVoiceDescription';
import { getElevenLabsMapping } from '@/lib/voiceMapping';
import { getVoiceById } from '@/lib/voices';
import { getVoiceSettingsFromPersonality } from '@/lib/generatePreviewText';

/**
 * Generate voice preview using ElevenLabs API
 * This matches what VAPI uses under the hood, ensuring preview matches actual voice
 * Supports personality-based voice settings when traits are provided
 */
export async function POST(request: NextRequest) {
  try {
    const { voiceId, text, traits } = await request.json();

    // Log the text being received to verify language
    console.log('[VOICE PREVIEW API] Received request:', {
      voiceId: voiceId?.substring(0, 20) + '...',
      textLength: text?.length,
      textPreview: text?.substring(0, 100),
      textLanguage: text?.substring(0, 50), // First 50 chars to see language
    });

    if (!voiceId || !text) {
      return NextResponse.json(
        { error: 'voiceId and text are required' },
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

    // Check if voiceId is already an ElevenLabs voice ID (typically 20+ character alphanumeric string)
    // ElevenLabs voice IDs are usually long alphanumeric strings
    const isElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(voiceId);
    
    let mapping = null;
    let elevenLabsVoiceId = null;
    
    if (isElevenLabsId) {
      // Voice ID is already an ElevenLabs ID, use it directly
      elevenLabsVoiceId = voiceId;
    } else {
      // Check if we have a mapping for this VAPI voice name
      mapping = getElevenLabsMapping(voiceId);
      elevenLabsVoiceId = mapping?.elevenLabsVoiceId;
      
      // If no mapping exists, try to find closest match automatically
      if (!mapping) {
        const vapiVoice = getVoiceById(voiceId);
        if (vapiVoice) {
          // Fetch ElevenLabs voices and find best match
          try {
            const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
              headers: { 'xi-api-key': apiKey },
            });
            if (voicesResponse.ok) {
              const voicesData = await voicesResponse.json();
              const voices = voicesData.voices || [];
              
              // Find best match by gender and accent
              const bestMatch = voices
                .map((v: any) => {
                  let score = 0;
                  if (v.labels?.gender?.toLowerCase() === vapiVoice.gender?.toLowerCase()) score += 10;
                  if (v.labels?.accent?.toLowerCase() === vapiVoice.accent?.toLowerCase()) score += 5;
                  return { voice: v, score };
                })
                .filter((m: any) => m.score > 0)
                .sort((a: any, b: any) => b.score - a.score)[0];
              
              if (bestMatch && bestMatch.score >= 10) {
                elevenLabsVoiceId = bestMatch.voice.voice_id;
                console.log(`[AUTO-MAPPED] ${voiceId} -> ${bestMatch.voice.name} (${bestMatch.voice.voice_id})`);
              }
            }
          } catch (error) {
            console.error('Failed to auto-match voice:', error);
          }
        }
      }
    }
    
    // If we have a preview URL and no personality traits (for basic voice preview), return it directly (faster)
    // Skip pre-generated URL if traits are provided, as we need to apply personality-based voice settings
    if (mapping?.elevenLabsPreviewUrl && (!traits || !Array.isArray(traits) || traits.length === 0)) {
      const previewResponse = await fetch(mapping.elevenLabsPreviewUrl);
      if (previewResponse.ok) {
        const audioBuffer = await previewResponse.arrayBuffer();
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours (pre-generated)
          },
        });
      }
    }

    // Use mapped, auto-matched, or direct ElevenLabs voice ID
    if (!elevenLabsVoiceId) {
      // Fallback: try the voiceId as-is (might be an ElevenLabs ID we didn't detect)
      elevenLabsVoiceId = voiceId;
    }

    // Get optimal voice settings based on text description
    // If traits are provided, use personality-based settings
    // Otherwise, optimize based on the text content itself
    let voiceSettings;
    if (traits && Array.isArray(traits) && traits.length > 0) {
      // Use personality-based settings if available
      voiceSettings = getVoiceSettingsFromPersonality(traits);
    } else {
      // Optimize based on text description
      const { extractedElements } = enhanceVoiceDescription(text);
      voiceSettings = getOptimalVoiceSettings(text, extractedElements);
      console.log('[VOICE PREVIEW API] Optimized voice settings based on text:', voiceSettings);
    }

    // ElevenLabs Text-to-Speech API endpoint
    console.log('[VOICE PREVIEW API] Calling ElevenLabs TTS with:', {
      voiceId: elevenLabsVoiceId?.substring(0, 20) + '...',
      textLength: text.length,
      textPreview: text.substring(0, 100),
      model: 'eleven_multilingual_v2',
      voiceSettings,
    });
    
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2', // Multilingual model - supports 70+ languages including Spanish and Arabic
          voice_settings: voiceSettings, // Use personality-based settings
        }),
      }
    );
    
    console.log('[VOICE PREVIEW API] ElevenLabs response status:', elevenLabsResponse.status, elevenLabsResponse.statusText);

    if (!elevenLabsResponse.ok) {
      const errorData = await elevenLabsResponse.json().catch(() => ({}));
      
      // If voice ID doesn't exist, provide helpful error
      if (elevenLabsResponse.status === 404) {
        console.error('[VOICE PREVIEW API] Voice not found (404):', {
          voiceId: voiceId?.substring(0, 20) + '...',
          elevenLabsVoiceId: elevenLabsVoiceId?.substring(0, 20) + '...',
          isElevenLabsId,
          hasMapping: !!mapping,
        });
        
        // For generated voices, the voice ID might be a temporary preview ID
        // Try to handle this gracefully
        if (isElevenLabsId && !mapping) {
          // This might be a generated voice ID that doesn't exist yet
          // Return a more helpful error message
          return NextResponse.json(
            { 
              error: `Voice preview not available. The voice ID may be invalid or the voice may have been deleted.`,
              hint: 'Try generating a new voice or selecting a different voice.',
              voiceId: voiceId?.substring(0, 20) + '...',
            },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { 
            error: `Voice "${voiceId}" not found in RAAR Voice Library.`,
            hint: mapping ? `Tried mapped ID: ${elevenLabsVoiceId}` : 'No mapping found for this voice',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Failed to generate voice preview',
          details: errorData,
          status: elevenLabsResponse.status,
        },
        { status: elevenLabsResponse.status }
      );
    }

    // Get the audio data
    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    // Return the audio file
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[ERROR] generateVoicePreview failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate voice preview',
      },
      { status: 500 }
    );
  }
}

