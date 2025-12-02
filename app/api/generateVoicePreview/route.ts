import { NextRequest, NextResponse } from 'next/server';
import { getOptimalVoiceSettings } from '@/lib/voiceSettingsOptimizer';
import { enhanceVoiceDescription } from '@/lib/enhanceVoiceDescription';
import { getElevenLabsMapping } from '@/lib/voiceMapping';
import { getVoiceById } from '@/lib/voices';
import { getVoiceSettingsFromPersonality } from '@/lib/generatePreviewText';
import { getVoiceConfigForVAPI } from '@/lib/voiceConfigHelper';
import { VAPI_TO_ELEVENLABS_MAPPING } from '@/lib/voiceMapping';
import { initializeVoiceLibrary, getAllCuratedVoices } from '@/lib/voiceLibrary';

/**
 * Generate voice preview using ElevenLabs API
 * This matches what VAPI uses under the hood, ensuring preview matches actual voice
 * Supports personality-based voice settings when traits are provided
 */
export async function POST(request: NextRequest) {
  try {
    const { voiceId, text, traits } = await request.json();

    // Detect environment (localhost vs production)
    const isLocalhost = process.env.NODE_ENV === 'development' || 
                       request.headers.get('host')?.includes('localhost') ||
                       request.headers.get('host')?.includes('127.0.0.1');

    // Log the text being received to verify language
    console.log('[VOICE PREVIEW API] Received request:', {
      voiceId: voiceId?.substring(0, 20) + '...',
      textLength: text?.length,
      textPreview: text?.substring(0, 100),
      textLanguage: text?.substring(0, 50), // First 50 chars to see language
      isLocalhost,
      environment: process.env.NODE_ENV,
    });

    if (!voiceId || !text) {
      console.error('[VOICE PREVIEW API] Missing required parameters:', {
        hasVoiceId: !!voiceId,
        hasText: !!text,
      });
      return NextResponse.json(
        { error: 'voiceId and text are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('[VOICE PREVIEW API] ELEVENLABS_API_KEY not found:', {
        hasApiKey: !!apiKey,
        isLocalhost,
        nodeEnv: process.env.NODE_ENV,
        envKeys: Object.keys(process.env).filter(k => k.includes('ELEVEN')).join(', '),
      });
      return NextResponse.json(
        { 
          error: 'ELEVENLABS_API_KEY not found in environment variables',
          hint: isLocalhost 
            ? 'Make sure your .env.local file contains ELEVENLABS_API_KEY and restart the dev server'
            : 'Check your environment variable configuration',
        },
        { status: 500 }
      );
    }

    console.log('[VOICE PREVIEW API] API key found:', {
      keyLength: apiKey.length,
      keyPrefix: apiKey.substring(0, 10) + '...',
      isLocalhost,
    });

    // Ensure voice library is initialized before resolving voice
    // This is needed for curated voice IDs (KM-XXXXXX) to be found
    let curatedVoices = getAllCuratedVoices();
    if (curatedVoices.length === 0) {
      curatedVoices = await initializeVoiceLibrary();
    }
    
    // Use the same voice resolution logic as agent creation
    // This ensures preview handles curated voice IDs (KM-OS2FRC), ElevenLabs IDs, and VAPI voice names correctly
    const voiceConfig = await getVoiceConfigForVAPI(voiceId);
    
    if (!voiceConfig) {
      console.error('[VOICE PREVIEW API] Could not resolve voice ID:', voiceId);
      return NextResponse.json(
        { 
          error: `Voice "${voiceId}" could not be resolved. Please select a valid voice.`,
          hint: 'The voice ID may be invalid or not found in the voice library.',
        },
        { status: 400 }
      );
    }

    // Extract ElevenLabs voice ID for preview generation
    // Only ElevenLabs voices can be used for preview (VAPI voices need to go through VAPI)
    let elevenLabsVoiceId: string | null = null;
    let mapping = null;
    
    if (voiceConfig.provider === '11labs') {
      elevenLabsVoiceId = voiceConfig.voiceId;
      // Check if we have a preview URL for this voice (for faster response when no traits)
      mapping = getElevenLabsMapping(voiceId);
      if (!mapping && voiceConfig.voiceId) {
        // Try to find mapping by ElevenLabs ID
        const allMappings = Object.values(VAPI_TO_ELEVENLABS_MAPPING);
        mapping = allMappings.find((m: any) => m.elevenLabsVoiceId === voiceConfig.voiceId) || null;
      }
    } else if (voiceConfig.provider === 'vapi') {
      // For VAPI voices, try to find ElevenLabs mapping
      mapping = getElevenLabsMapping(voiceConfig.voiceId);
      elevenLabsVoiceId = mapping?.elevenLabsVoiceId || null;
      
      if (!elevenLabsVoiceId) {
        // Try to find closest match automatically
        const vapiVoice = getVoiceById(voiceConfig.voiceId);
        if (vapiVoice) {
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
    
    if (!elevenLabsVoiceId) {
      // Check if voiceId looks like a direct ElevenLabs ID (long alphanumeric string, 20+ characters)
      // If so, try using it directly with ElevenLabs API
      const looksLikeElevenLabsId = voiceId && voiceId.length >= 20 && /^[a-zA-Z0-9]+$/.test(voiceId);
      
      if (looksLikeElevenLabsId) {
        console.log('[VOICE PREVIEW API] Voice ID looks like direct ElevenLabs ID, trying directly:', voiceId.substring(0, 20) + '...');
        // Try using it directly
        try {
          const directCheckResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'xi-api-key': apiKey,
            },
          });
          
          if (directCheckResponse.ok) {
            // Voice exists, use it directly
            elevenLabsVoiceId = voiceId;
            console.log('[VOICE PREVIEW API] Direct ElevenLabs ID validated, using it for preview');
          } else {
            // Voice doesn't exist in account
            console.warn('[VOICE PREVIEW API] Direct ElevenLabs ID does not exist in account');
            return NextResponse.json(
              { 
                error: `Preview not available for this voice, but it will work in calls.`,
                hint: 'This voice may not be available in your ElevenLabs account for preview, but VAPI can still use it.',
              },
              { status: 400 }
            );
          }
        } catch (error) {
          console.error('[VOICE PREVIEW API] Error checking direct ElevenLabs ID:', error);
          return NextResponse.json(
            { 
              error: `Preview not available for this voice, but it will work in calls.`,
              hint: 'Unable to verify voice for preview, but it should work in actual calls.',
            },
            { status: 400 }
          );
        }
      } else {
        // Not a direct ElevenLabs ID, can't resolve
        console.error('[VOICE PREVIEW API] Could not resolve to ElevenLabs voice ID:', voiceId);
        return NextResponse.json(
          { 
            error: `Voice preview not available for "${voiceId}". This voice may not have an ElevenLabs equivalent.`,
            hint: 'Try selecting a different voice that supports preview.',
          },
          { status: 400 }
        );
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
      isLocalhost,
    });
    
    // Add retry logic for network issues (especially on localhost)
    let elevenLabsResponse: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = isLocalhost ? 3 : 1; // More retries on localhost due to potential network issues
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        elevenLabsResponse = await fetch(
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
        
        console.log(`[VOICE PREVIEW API] ElevenLabs response (attempt ${attempt}/${maxRetries}):`, {
          status: elevenLabsResponse.status,
          statusText: elevenLabsResponse.statusText,
          isLocalhost,
        });
        
        // If successful, break out of retry loop
        if (elevenLabsResponse.ok) {
          break;
        }
        
        // If it's a client error (4xx), don't retry
        if (elevenLabsResponse.status >= 400 && elevenLabsResponse.status < 500) {
          break;
        }
        
        // If it's a server error (5xx) or network error, retry
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
          console.log(`[VOICE PREVIEW API] Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[VOICE PREVIEW API] Network error on attempt ${attempt}/${maxRetries}:`, {
          error: lastError.message,
          isLocalhost,
        });
        
        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Otherwise, wait and retry
        const waitTime = attempt * 1000;
        console.log(`[VOICE PREVIEW API] Retrying after network error in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    if (!elevenLabsResponse) {
      throw new Error(lastError?.message || 'Failed to get response from ElevenLabs API');
    }

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

      // Provide more specific error messages based on status code
      let errorMessage = 'Failed to generate voice preview';
      let errorHint = '';
      
      if (elevenLabsResponse.status === 401) {
        errorMessage = 'Authentication failed with ElevenLabs API';
        errorHint = isLocalhost 
          ? 'Check that ELEVENLABS_API_KEY in .env.local is valid and restart the dev server'
          : 'Check that ELEVENLABS_API_KEY environment variable is valid';
      } else if (elevenLabsResponse.status === 429) {
        errorMessage = 'Rate limit exceeded for ElevenLabs API';
        errorHint = 'Too many requests. Please wait a moment and try again.';
      } else if (elevenLabsResponse.status >= 500) {
        errorMessage = 'ElevenLabs API server error';
        errorHint = 'The ElevenLabs service is temporarily unavailable. Please try again later.';
      } else if (elevenLabsResponse.status === 400) {
        errorMessage = 'Invalid request to ElevenLabs API';
        errorHint = errorData?.detail?.message || 'The voice ID or text may be invalid.';
      }
      
      console.error('[VOICE PREVIEW API] ElevenLabs API error:', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        errorData,
        voiceId: elevenLabsVoiceId?.substring(0, 20) + '...',
        isLocalhost,
      });
      
      return NextResponse.json(
        { 
          error: errorMessage,
          hint: errorHint,
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
    const isLocalhost = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate voice preview';
    
    console.error('[ERROR] generateVoicePreview failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      isLocalhost,
      nodeEnv: process.env.NODE_ENV,
    });
    
    // Provide helpful error messages based on error type
    let hint = '';
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
      hint = isLocalhost
        ? 'Network error. Check your internet connection and ensure ElevenLabs API is accessible from localhost.'
        : 'Network error connecting to ElevenLabs API.';
    } else if (errorMessage.includes('timeout')) {
      hint = 'Request timed out. The ElevenLabs API may be slow or unavailable.';
    } else if (errorMessage.includes('API key') || errorMessage.includes('ELEVENLABS')) {
      hint = isLocalhost
        ? 'Check that ELEVENLABS_API_KEY is set in .env.local and restart the dev server.'
        : 'Check that ELEVENLABS_API_KEY environment variable is configured.';
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        hint: hint || 'An unexpected error occurred while generating the voice preview.',
      },
      { status: 500 }
    );
  }
}

