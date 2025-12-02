import { NextRequest, NextResponse } from 'next/server';
import { getVoiceConfigForVAPI } from '@/lib/voiceConfigHelper';
import { getCuratedVoiceById } from '@/lib/voiceLibrary';

/**
 * Validate that a voice can be used with VAPI
 * Checks if voice exists in ElevenLabs or VAPI before agent creation
 * Can be used as a helper function or API endpoint
 */
export async function validateVoiceForVAPI(voiceId: string): Promise<{ valid: boolean; error?: string; details?: string; voiceConfig?: { provider: '11labs' | 'vapi'; voiceId: string }; voiceName?: string }> {
  try {

    if (!voiceId || typeof voiceId !== 'string' || !voiceId.trim()) {
      return {
        valid: false,
        error: 'Voice ID is required',
      };
    }

    const trimmedVoiceId = voiceId.trim();

    // Step 1: Try to get voice config using helper
    const voiceConfig = await getVoiceConfigForVAPI(trimmedVoiceId);

    if (!voiceConfig) {
      // Check if it's a curated voice ID that might not be in the mapping
      const curatedVoice = getCuratedVoiceById(trimmedVoiceId);
      
      if (curatedVoice) {
        // We have a curated voice - validate it exists
        if (curatedVoice.source === 'elevenlabs' && curatedVoice.elevenLabsVoiceId) {
          // Validate ElevenLabs voice exists
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (apiKey) {
            try {
              const response = await fetch(`https://api.elevenlabs.io/v1/voices/${curatedVoice.elevenLabsVoiceId}`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'xi-api-key': apiKey,
                },
              });

              if (response.ok) {
                return {
                  valid: true,
                  voiceConfig: {
                    provider: '11labs',
                    voiceId: curatedVoice.elevenLabsVoiceId,
                  },
                  voiceName: curatedVoice.name,
                };
          } else {
            const errorText = await response.text().catch(() => '');
            return {
              valid: false,
              error: 'Voice not available in your ElevenLabs account',
              details: `The voice "${curatedVoice.name}" (ID: ${curatedVoice.elevenLabsVoiceId}) is not available in your ElevenLabs account. Please select a different voice from the available options.`,
            };
          }
            } catch (error) {
              console.error('[VOICE VALIDATION] Error checking ElevenLabs voice:', error);
              return {
                valid: false,
                error: 'Failed to validate voice with ElevenLabs',
                details: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          }
        } else if (curatedVoice.source === 'vapi' && curatedVoice.vapiVoiceId) {
          // VAPI voices are assumed valid (they're native to VAPI)
          return {
            valid: true,
            voiceConfig: {
              provider: 'vapi',
              voiceId: curatedVoice.vapiVoiceId,
            },
            voiceName: curatedVoice.name,
          };
        }
      }

      // Check if it looks like an ElevenLabs voice ID (long alphanumeric string)
      // This handles direct ElevenLabs IDs that weren't found in the curated library
      const looksLikeElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceId) && 
                                     trimmedVoiceId.length >= 15 && 
                                     trimmedVoiceId.length <= 25 &&
                                     !trimmedVoiceId.includes('-') &&
                                     !trimmedVoiceId.includes(' ');
      
      if (looksLikeElevenLabsId) {
        // It's an ElevenLabs voice ID - validate it exists
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (apiKey) {
          try {
            const response = await fetch(`https://api.elevenlabs.io/v1/voices/${trimmedVoiceId}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'xi-api-key': apiKey,
              },
            });

            if (response.ok) {
              const voiceData = await response.json();
              return {
                valid: true,
                voiceConfig: {
                  provider: '11labs',
                  voiceId: trimmedVoiceId,
                },
                voiceName: voiceData.name || 'Unknown',
              };
            } else {
              const errorText = await response.text().catch(() => '');
              return {
                valid: false,
                error: 'Voice not available in your ElevenLabs account',
                details: `The selected voice (ID: ${trimmedVoiceId}) is not available in your ElevenLabs account. This voice may not exist or may not be accessible with your API key. Please select a different voice from the available options.`,
              };
            }
          } catch (error) {
            console.error('[VOICE VALIDATION] Error checking ElevenLabs voice:', error);
            return {
              valid: false,
              error: 'Failed to validate voice with ElevenLabs',
              details: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        } else {
          return {
            valid: false,
            error: 'ElevenLabs API key not configured',
          };
        }
      }

      return {
        valid: false,
        error: 'Voice ID not found or invalid',
        details: `Could not find voice configuration for: ${trimmedVoiceId}`,
      };
    }

    // Step 2: Validate the voice actually exists
    if (voiceConfig.provider === '11labs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (apiKey) {
        try {
          const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceConfig.voiceId}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'xi-api-key': apiKey,
            },
          });

          if (response.ok) {
            const voiceData = await response.json();
            return {
              valid: true,
              voiceConfig: voiceConfig,
              voiceName: voiceData.name || 'Unknown',
            };
          } else {
            const errorText = await response.text().catch(() => '');
            return {
              valid: false,
              error: 'Voice not available in your ElevenLabs account',
              details: `The selected voice (ID: ${voiceConfig.voiceId}) is not available in your ElevenLabs account. This voice may not exist or may not be accessible with your API key. Please select a different voice from the available options.`,
            };
          }
        } catch (error) {
          console.error('[VOICE VALIDATION] Error checking ElevenLabs voice:', error);
          return {
            valid: false,
            error: 'Failed to validate voice with ElevenLabs',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else {
        return {
          valid: false,
          error: 'ElevenLabs API key not configured',
        };
      }
    } else if (voiceConfig.provider === 'vapi') {
      // VAPI voices are assumed valid (they're native to VAPI)
      // We could add validation here if VAPI provides a voice list API
      return {
        valid: true,
        voiceConfig: voiceConfig,
        voiceName: voiceConfig.voiceId, // VAPI voice names are the ID
      };
    }

    return {
      valid: false,
      error: 'Unknown voice provider',
      details: `Provider ${voiceConfig.provider} is not supported`,
    };
  } catch (error) {
    console.error('[ERROR] validateVoiceForVAPI failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate voice',
    };
  }
}

/**
 * API endpoint handler
 */
export async function POST(request: NextRequest) {
  try {
    const { voiceId } = await request.json();
    const result = await validateVoiceForVAPI(voiceId);
    
    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ERROR] validateVoiceForVAPI POST failed:', error);
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate voice',
      },
      { status: 500 }
    );
  }
}

