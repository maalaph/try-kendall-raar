import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceDescription } from '@/lib/parseVoiceDescription';
import { initializeVoiceLibrary, getAllCuratedVoices } from '@/lib/voiceLibrary';
import { matchDescriptionToVoice } from '@/lib/voiceMatcher';
import { normalizeVoiceDescription, formatForElevenLabsAPI } from '@/lib/voiceDescriptionNormalizer';

/**
 * Search for voices matching a description
 * Uses curated voice library with intelligent matching
 */
export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Parse the description using the same function as frontend
    const attributes = parseVoiceDescription(description.trim());
    
    // Debug logging
    console.log('[SEARCH DEBUG] Parsed attributes:', JSON.stringify(attributes, null, 2));
    console.log('[SEARCH DEBUG] Description:', description.trim());
    console.log('[SEARCH DEBUG] Extracted - accent:', attributes.accent, 'gender:', attributes.gender);

    // Initialize curated voice library if needed - ENHANCED: Ensure library is always loaded
    let curatedVoices = getAllCuratedVoices();
    if (curatedVoices.length === 0) {
      console.log('[SEARCH DEBUG] Voice library empty, initializing...');
      curatedVoices = await initializeVoiceLibrary();
      
      if (curatedVoices.length === 0) {
        console.error('[SEARCH ERROR] Failed to initialize voice library');
        return NextResponse.json(
          { error: 'Voice library not available. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    console.log(`[SEARCH DEBUG] Searching ${curatedVoices.length} curated voices (${curatedVoices.filter(v => v.source === 'elevenlabs').length} ElevenLabs, ${curatedVoices.filter(v => v.source === 'vapi').length} VAPI)`);

    // Use curated library matching - ENHANCED: Return more matches (10 instead of 5)
    const matches = matchDescriptionToVoice(description.trim(), curatedVoices, 10);
    
    console.log(`[SEARCH DEBUG] Found ${matches.length} matching curated voices`);
    if (matches.length > 0) {
      console.log('[SEARCH DEBUG] Top matches:', matches.slice(0, 5).map(m => ({
        id: m.voice.id,
        name: m.voice.name,
        score: m.score,
        gender: m.voice.gender,
        accent: m.voice.accent,
        ageGroup: m.voice.ageGroup,
        tone: m.voice.tone,
        source: m.voice.source,
        quality: m.voice.quality,
      })));
      
      // Log match quality distribution
      const elevenLabsMatches = matches.filter(m => m.voice.source === 'elevenlabs').length;
      const vapiMatches = matches.filter(m => m.voice.source === 'vapi').length;
      console.log(`[SEARCH DEBUG] Match distribution: ${elevenLabsMatches} ElevenLabs, ${vapiMatches} VAPI`);
    } else {
      console.log('[SEARCH DEBUG] No curated voice matches found');
    }
    
    // Transform matches to response format
    // Enhanced: Remove ElevenLabs references, brand as RAAR
    const allMatches = matches.map(match => ({
      id: match.voice.id,
      name: match.voice.name,
      gender: match.voice.gender,
      accent: match.voice.accent,
      ageGroup: match.voice.ageGroup,
      description: match.voice.description,
      score: match.score,
      source: 'raar', // Brand as RAAR (hide 'elevenlabs' or 'vapi')
      voiceId: match.voice.elevenLabsVoiceId || match.voice.vapiVoiceId, // Generic voiceId (hide source-specific IDs)
      quality: match.voice.quality, // 'high' or 'standard'
      tags: match.voice.tags,
      tone: match.voice.tone,
      matchDetails: match.matchDetails,
      // Keep internal IDs for backend use only (not exposed to users)
      _internal: {
        source: match.voice.source,
        elevenLabsVoiceId: match.voice.elevenLabsVoiceId,
        vapiVoiceId: match.voice.vapiVoiceId,
      },
    }));
    
    // Get best match for preview
    const bestMatch = allMatches[0] || null;
    
    // Enhanced: Fallback to Voice Design API if no good match
    // The matcher now returns empty array if confidence is too low (score < 50)
    // This ensures we only return high-quality matches or generate a custom voice
    let fallbackGenerated = false;
    
    if (matches.length === 0 || !bestMatch) {
      console.log(`[SEARCH] No good matches found (matches: ${matches.length}), falling back to Voice Design API for custom generation`);
      
      try {
        // Normalize description for Voice Design API
        const normalizedParams = normalizeVoiceDescription(attributes, description.trim());
        const normalizedDescription = formatForElevenLabsAPI(normalizedParams, attributes.character);
        
        // Generate sample text using enhanceVoiceDescription
        const { enhanceVoiceDescription, generateStyleAppropriateText } = await import('@/lib/enhanceVoiceDescription');
        const { enhanced, extractedElements } = enhanceVoiceDescription(normalizedDescription);
        const sampleText = generateStyleAppropriateText(enhanced, extractedElements);
        
        // Call ElevenLabs Voice Design API
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (apiKey) {
          const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/design', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({
              model_id: 'eleven_multilingual_ttv_v2',
              voice_description: normalizedDescription,
              text: sampleText,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const previews = data.previews || [];
            
            // Add generated voices to matches
            const generatedMatches = previews.map((preview: any, index: number) => {
              const audioBase64 = preview.audio_base_64 || preview.audioBase64;
              const generatedVoiceId = preview.generated_voice_id || `generated-${index}`;
              
              // CRITICAL: Ensure audioBase64 is always present for generated voices
              if (!audioBase64) {
                console.warn(`[SEARCH] Generated voice ${index} missing audioBase64, skipping`);
                return null;
              }
              
              return {
                id: generatedVoiceId,
                name: attributes.character 
                  ? `${attributes.character.charAt(0).toUpperCase() + attributes.character.slice(1)} ${index + 1}`
                  : `Voice ${index + 1}`,
                gender: attributes.gender || 'neutral',
                accent: attributes.accent || 'American',
                ageGroup: attributes.ageGroup || 'middle-aged',
                description: normalizedDescription,
                score: 50, // Generated voices get a base score
                source: 'raar', // Brand as RAAR (hide 'generated')
                voiceId: generatedVoiceId, // Generic voiceId (hide 'elevenLabsVoiceId')
                audioBase64: audioBase64, // CRITICAL: Always include base64 audio for direct preview
                tags: (attributes.tags || (attributes.character ? [attributes.character] : [])).filter(tag => {
                  // Filter out tags that don't match the description
                  const descriptionLower = description.trim().toLowerCase();
                  const tagLower = tag.toLowerCase();
                  // Only include tags that are in the description or are valid characteristics
                  return descriptionLower.includes(tagLower) || 
                         ['male', 'female', 'neutral', 'young', 'middle-aged', 'older'].includes(tagLower) ||
                         descriptionLower.includes(tagLower.split(' ')[0]); // Check first word of compound tags
                }),
                tone: [],
                matchDetails: {
                  accentMatch: !!attributes.accent,
                  genderMatch: !!attributes.gender,
                  ageMatch: !!attributes.ageGroup,
                  tagMatches: attributes.tags || (attributes.character ? [attributes.character] : []),
                  toneMatches: [],
                  keywordMatches: attributes.character ? [attributes.character] : [],
                },
                // Keep internal IDs for backend use only
                _internal: {
                  source: 'generated',
                  generatedVoiceId: generatedVoiceId,
                  elevenLabsVoiceId: generatedVoiceId,
                },
              };
            }).filter((match): match is NonNullable<typeof match> => match !== null); // Filter out null entries
            
            allMatches.push(...generatedMatches);
            fallbackGenerated = true;
            console.log(`[SEARCH] Generated ${generatedMatches.length} fallback voices`);
          } else {
            console.warn('[SEARCH] Voice Design API fallback failed:', response.status);
          }
        }
      } catch (error) {
        console.error('[SEARCH] Error in Voice Design API fallback:', error);
      }
    }
    
    return NextResponse.json({
      matches: allMatches,
      bestMatch: allMatches[0] || null,
      parsedAttributes: attributes,
      fallbackGenerated,
    });
  } catch (error) {
    console.error('[ERROR] searchVoicesByDescription failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to search voices',
      },
      { status: 500 }
    );
  }
}
