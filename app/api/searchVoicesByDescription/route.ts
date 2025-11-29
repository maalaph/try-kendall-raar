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

    // Initialize curated voice library FIRST - needed for dynamic attribute extraction
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

    // Parse the description using dynamic matching against voice library
    const attributes = parseVoiceDescription(description.trim(), curatedVoices);
    
    // Debug logging
    console.log('[SEARCH DEBUG] Parsed attributes:', JSON.stringify(attributes, null, 2));
    console.log('[SEARCH DEBUG] Description:', description.trim());
    console.log('[SEARCH DEBUG] Extracted - accent:', attributes.accent, 'gender:', attributes.gender);
    
    console.log(`[SEARCH DEBUG] Searching ${curatedVoices.length} curated voices (${curatedVoices.filter(v => v.source === 'elevenlabs').length} ElevenLabs, ${curatedVoices.filter(v => v.source === 'vapi').length} VAPI)`);

    // Use curated library matching - Return top matches (fewer for character queries)
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
    
    // CRITICAL: Disable Voice Design API fallback entirely
    // If description doesn't match anything in library, return empty results - no suggestions, no generated voices
    // Users prefer empty results over generated voices that don't match their request
    
    // Check if user specified an accent that doesn't exist in library
    // This validation should already happen in voiceMatcher.ts, but double-check here
    if (attributes.accent && matches.length === 0) {
      // Verify accent doesn't exist - if it was parsed but no matches, it likely doesn't exist
      const availableAccents = new Set(
        curatedVoices
          .map(v => v.accent?.toLowerCase().trim())
          .filter((accent): accent is string => !!accent)
      );
      const parsedAccentLower = attributes.accent.toLowerCase().trim();
      const accentExists = Array.from(availableAccents).some(acc => {
        if (acc === parsedAccentLower) return true;
        // For single-word accents, require exact match
        const parsedWords = parsedAccentLower.split(/[- ]+/);
        const availableWords = acc.split(/[- ]+/);
        if (parsedWords.length === 1 && availableWords.length === 1) {
          return availableWords[0] === parsedWords[0];
        }
        // For compound accents, check word-by-word match
        return parsedWords.length === availableWords.length &&
               parsedWords.every((pw, idx) => availableWords[idx] === pw);
      });
      
      if (!accentExists) {
        console.log(`[SEARCH] Accent "${attributes.accent}" specified but doesn't exist in library. Returning empty results (no fallback, no suggestions).`);
        return NextResponse.json({
          matches: [],
          bestMatch: null,
          parsedAttributes: attributes,
          fallbackGenerated: false,
          message: 'Sorry, none of our voices match your description.',
        });
      }
    }
    
    // CRITICAL: If no matches found, return empty results with user-friendly message
    // DO NOT generate voices, DO NOT show suggestions, DO NOT assume different attributes
    if (matches.length === 0 || !bestMatch) {
      console.log(`[SEARCH] No matches found in library. Returning empty results (no generated voices, no suggestions).`);
      return NextResponse.json({
        matches: [],
        bestMatch: null,
        parsedAttributes: attributes,
        fallbackGenerated: false,
        message: 'Sorry, none of our voices match your description.',
      });
    }
    
    return NextResponse.json({
      matches: allMatches,
      bestMatch: allMatches[0] || null,
      parsedAttributes: attributes,
      fallbackGenerated: false, // Always false - we don't generate voices anymore
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
