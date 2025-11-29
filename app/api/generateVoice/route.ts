import { NextRequest, NextResponse } from 'next/server';
import { enhanceVoiceDescription, generateStyleAppropriateText } from '@/lib/enhanceVoiceDescription';
import { sanitizeVoiceDescription } from '@/lib/sanitizeVoiceDescription';
import { scorePromptQuality } from '@/lib/promptQualityScorer';
import { getCachedVoice, cacheVoice, createDescriptionHash } from '@/lib/voiceCache';
import { rankVoicesByQuality } from '@/lib/voiceQualityScorer';
import { parseVoiceDescription } from '@/lib/parseVoiceDescription';
import { normalizeVoiceDescription, formatForElevenLabsAPI } from '@/lib/voiceDescriptionNormalizer';

/**
 * Generate voice previews using ElevenLabs Voice Design API
 * This generates voice previews based on a text description
 * Returns multiple voice options that the user can preview and select
 */
export async function POST(request: NextRequest) {
  try {
    // Safely parse request body with error handling
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('[VOICE GENERATION] Failed to parse request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      );
    }

    // Validate request body structure
    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          message: 'Request body must be an object'
        },
        { status: 400 }
      );
    }

    const { description } = requestBody;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Description is required',
          requirements: {
            minLength: 20,
            maxLength: 1000,
            message: 'ElevenLabs requires descriptions between 20-1000 characters'
          }
        },
        { status: 400 }
      );
    }

    // Validate description length (ElevenLabs requires 20-1000 characters)
    const trimmedDescription = description.trim();
    
    if (trimmedDescription.length < 20) {
      // Score quality for feedback
      const quality = scorePromptQuality(trimmedDescription);
      return NextResponse.json(
        { 
          error: 'Description must be at least 20 characters long',
          currentLength: trimmedDescription.length,
          requiredLength: 20,
          quality: quality,
          requirements: {
            minLength: 20,
            maxLength: 1000,
            message: 'ElevenLabs requires descriptions between 20-1000 characters. Add more details to your description for better results.'
          }
        },
        { status: 400 }
      );
    }
    if (trimmedDescription.length > 1000) {
      // Score quality for feedback
      const quality = scorePromptQuality(trimmedDescription);
      return NextResponse.json(
        { 
          error: 'Description must be no more than 1000 characters long',
          currentLength: trimmedDescription.length,
          maxLength: 1000,
          quality: quality,
          requirements: {
            minLength: 20,
            maxLength: 1000,
            message: 'ElevenLabs has a maximum of 1000 characters. Please shorten your description.'
          }
        },
        { status: 400 }
      );
    }
    
    // Score prompt quality for validation and feedback
    const quality = scorePromptQuality(trimmedDescription);
    
    // Warn if quality is very low (but don't block - let ElevenLabs decide)
    if (quality.overall < 30) {
      console.warn('[VOICE GENERATION] Low quality prompt detected:', {
        score: quality.overall,
        level: quality.level,
        suggestions: quality.suggestions,
      });
    }

    // Check cache after validation (Phase 5.1: Voice Generation Caching)
    const descriptionHash = createDescriptionHash(trimmedDescription);
    const cachedVoice = await getCachedVoice(trimmedDescription);
    
    if (cachedVoice) {
      console.log('[VOICE GENERATION] Cache hit! Returning cached voice');
      return NextResponse.json({
        success: true,
        voices: [{
          id: cachedVoice.generatedVoiceId,
          generatedVoiceId: cachedVoice.generatedVoiceId,
          name: 'Cached Voice',
          description: cachedVoice.description,
          originalDescription: trimmedDescription,
          audioBase64: cachedVoice.audioBase64,
          source: 'cached',
        }],
        cached: true,
        description: cachedVoice.description,
        originalDescription: trimmedDescription,
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    // Step 1: Sanitize description (remove problematic terms for safety)
    const { sanitized: sanitizedDesc, wasModified: wasSanitized, suggestions: sanitizeSuggestions } = sanitizeVoiceDescription(trimmedDescription);
    
    // Step 2: Parse description to extract structured attributes
    const attributes = parseVoiceDescription(sanitizedDesc);
    
    // Step 3: Normalize to ElevenLabs Voice Design API format
    const normalizedParams = normalizeVoiceDescription(attributes, sanitizedDesc);
    const normalizedDescription = formatForElevenLabsAPI(normalizedParams, attributes.character);
    
    // Step 4: Enhance description dynamically (extract all elements and structure properly)
    const { enhanced, extractedElements } = enhanceVoiceDescription(normalizedDescription);
    
    // Step 5: Generate style-appropriate sample text
    const sampleText = generateStyleAppropriateText(enhanced, extractedElements);

    console.log('[VOICE GENERATION]', {
      original: trimmedDescription,
      sanitized: sanitizedDesc,
      normalized: normalizedDescription,
      enhanced: enhanced,
      elements: extractedElements,
      sampleTextLength: sampleText.length,
    });

    // ElevenLabs Voice Design API endpoint - generates voice previews from description
    // Endpoint: /v1/text-to-voice/design
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/design', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          model_id: 'eleven_multilingual_ttv_v2',
          voice_description: normalizedDescription, // Use normalized description (not raw enhanced)
          text: sampleText, // Use dynamic style-appropriate sample text
        }),
      });

      if (!response.ok) {
        // Get error response as text first, then try to parse
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        
        // Log the full error for debugging - this will show in your terminal
        console.error('[ERROR] ElevenLabs API error response:', JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestBody: {
            model_id: 'eleven_multilingual_ttv_v2',
            voice_description: enhanced,
            text: sampleText.substring(0, 100) + '...',
          }
        }, null, 2));
        
        // Check for safety block - Brand as RAAR
        if (errorData?.detail?.status === 'blocked_generation') {
          return NextResponse.json(
            {
              error: 'This description may not follow safety guidelines',
              message: errorData.detail.message || 'Please try rephrasing your description',
              suggestion: wasSanitized 
                ? `We tried adjusting your description, but it was still blocked. Please review and try a different description.`
                : 'Please review your description and try rephrasing it.',
              wasSanitized: wasSanitized,
              sanitizeSuggestions: sanitizeSuggestions,
              quality: quality, // Include quality score
              requirements: {
                restrictions: 'Certain descriptions may be restricted. Try rephrasing with different terms.',
                minLength: 20,
                maxLength: 1000,
              }
            },
            { status: 403 }
          );
        }

        // Check if it's a plan limitation - Brand as RAAR
        if (response.status === 403 || response.status === 402) {
          const isFeatureUnavailable = errorData?.detail?.status === 'feature_unavailable';
          return NextResponse.json(
            {
              error: isFeatureUnavailable 
                ? 'Voice generation requires a paid plan'
                : 'Voice generation is not available',
              message: isFeatureUnavailable
                ? 'Voice generation requires upgrading to a paid plan.'
                : 'There was an issue with voice generation.',
              requirements: {
                planRequired: 'Paid plan required',
                message: 'Voice generation from descriptions requires a paid subscription.',
              },
              details: errorData,
            },
            { status: 403 }
          );
        }

        // Check for validation errors
        if (response.status === 422 && errorData?.detail) {
          const validationErrors = Array.isArray(errorData.detail) ? errorData.detail : [errorData.detail];
          const textError = validationErrors.find((err: any) => err.loc?.includes('text'));
          
          if (textError) {
            return NextResponse.json(
              {
                error: 'Sample text validation failed',
                message: textError.msg || 'The sample text does not meet requirements',
                requirements: {
                  textMinLength: 100,
                  message: 'ElevenLabs requires the sample text to be at least 100 characters long.',
                },
                details: errorData,
              },
              { status: 422 }
            );
          }
        }

        return NextResponse.json(
          {
            error: 'Failed to generate voice',
            message: 'RAAR was unable to generate a voice with this description. Please try again with a different description.',
            details: errorData,
            status: response.status,
            quality: quality, // Include quality score for feedback
            requirements: {
              minLength: 20,
              maxLength: 1000,
              message: 'Ensure your description is between 20-1000 characters and includes details about accent, gender, tone, and style.',
            }
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      // Voice Design API returns previews with generated_voice_id and audio samples
      // Transform the response to match our frontend expectations
      const previews = data.previews || [];
      
      if (!Array.isArray(previews) || previews.length === 0) {
        console.error('[VOICE GENERATION] No previews in response:', data);
        return NextResponse.json(
          {
            error: 'No voice previews were generated',
            message: 'RAAR was unable to generate voice previews. Please try a different description.',
            details: data,
          },
          { status: 500 }
        );
      }
      
      const generatedVoices = previews.map((preview: any, index: number) => {
        // Handle both possible field names: audio_base_64 (ElevenLabs format) and audioBase64 (our format)
        const audioBase64 = preview.audio_base_64 || preview.audioBase64;
        
        if (!audioBase64) {
          console.error(`[VOICE GENERATION] Preview ${index} missing audio data - this should not happen:`, {
            hasAudioBase64: !!preview.audio_base_64,
            hasAudioBase64Alt: !!preview.audioBase64,
            previewKeys: Object.keys(preview),
          });
        }
        
        if (!preview.generated_voice_id) {
          console.warn(`[VOICE GENERATION] Preview ${index} missing generated_voice_id:`, preview);
        }
        
        // Include character in name if present
        const characterName = attributes.character 
          ? `${attributes.character.charAt(0).toUpperCase() + attributes.character.slice(1)} ${index + 1}`
          : `Voice ${index + 1}`;
        
        return {
          id: preview.generated_voice_id || `generated-${index}`,
          generatedVoiceId: preview.generated_voice_id || `generated-${index}`,
          voiceId: preview.generated_voice_id || `generated-${index}`, // Generic voiceId (hide source)
          name: characterName,
          gender: attributes.gender || 'neutral', // CRITICAL: Use parsed gender from description
          accent: attributes.accent || 'American', // Include accent if parsed
          ageGroup: attributes.ageGroup || 'middle-aged', // Include age group if parsed
          description: normalizedDescription, // Use normalized description (includes character)
          originalDescription: trimmedDescription, // Keep original for reference
          audioBase64: audioBase64 || null, // Ensure we have audio data
          source: 'raar', // Brand as RAAR (hide 'generated')
          character: attributes.character, // Include character for reference
          tags: attributes.tags || (attributes.character ? [attributes.character] : []), // Include tags
          // Keep internal IDs for backend use only
          _internal: {
            source: 'generated',
            generatedVoiceId: preview.generated_voice_id || `generated-${index}`,
          },
        };
      }).filter((voice: any) => {
        // CRITICAL: Only include voices with valid audioBase64
        // Log any that are filtered out for debugging
        if (!voice.audioBase64) {
          console.error('[VOICE GENERATION] Filtering out voice without audioBase64:', {
            id: voice.id,
            name: voice.name,
            generatedVoiceId: voice.generatedVoiceId,
          });
        }
        return !!voice.audioBase64 && voice.audioBase64.length > 0;
      });

      // Phase 5.4: Rank voices by quality and return top voices first
      const rankedVoices = rankVoicesByQuality(generatedVoices, enhanced, extractedElements);
      const topVoices = rankedVoices.map(scored => ({
        ...scored.voice,
        qualityScore: scored.score.overall, // Include quality score for frontend
      }));
      
      if (topVoices.length === 0) {
        console.error('[VOICE GENERATION] No voices with valid audio data:', previews);
        return NextResponse.json(
          {
            error: 'No valid voice previews were generated',
            message: 'RAAR generated voices but audio data is missing. Please try again.',
            details: { previewCount: previews.length },
          },
          { status: 500 }
        );
      }

      // Cache the top quality voice (Phase 5.1: Voice Generation Caching)
      if (topVoices.length > 0 && topVoices[0].audioBase64) {
        await cacheVoice({
          generatedVoiceId: topVoices[0].generatedVoiceId || topVoices[0].id,
          audioBase64: topVoices[0].audioBase64,
          description: normalizedDescription,
          language: undefined, // Could extract from description if needed
          timestamp: new Date().toISOString(),
          descriptionHash: descriptionHash,
        });
      }

      return NextResponse.json({
        success: true,
        voices: topVoices, // Return ranked voices (best quality first)
        previews: previews,
        description: normalizedDescription,
        originalDescription: trimmedDescription,
        wasEnhanced: true,
        wasSanitized: wasSanitized,
        extractedElements: extractedElements,
        quality: quality, // Include quality score in response
        cached: false,
      });
    } catch (error) {
      console.error('[ERROR] Voice Design API call failed:', error);
      return NextResponse.json(
        {
          error: 'Failed to generate voice',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[ERROR] generateVoice failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate voice',
      },
      { status: 500 }
    );
  }
}


