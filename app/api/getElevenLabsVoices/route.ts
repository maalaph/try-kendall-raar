import { NextRequest, NextResponse } from 'next/server';
import { initializeVoiceLibrary, getAllCuratedVoices, filterCuratedVoices, validateVoicesAgainstElevenLabs } from '@/lib/voiceLibrary';

/**
 * Fetch available voices from RAAR Voice Library
 * Supports filtering by gender
 * 
 * NOTE: RAAR voices are language-agnostic - any voice can speak any supported language.
 * The language is determined by the input text, not the voice itself.
 * Query params: ?language=en|es|ar (for UI purposes only, doesn't filter) &gender=male|female
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize curated voice library if needed
    let curatedVoices = getAllCuratedVoices();
    if (curatedVoices.length === 0) {
      curatedVoices = await initializeVoiceLibrary();
    }

    // Get filter parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const languageFilter = searchParams.get('language'); // 'en', 'es', 'ar', or 'all' - kept for UI but doesn't filter
    const genderFilter = searchParams.get('gender'); // 'male', 'female', or 'all'

    // Apply filters
    const filters: {
      gender?: 'male' | 'female' | 'neutral';
    } = {};

    if (genderFilter && genderFilter !== 'all') {
      filters.gender = genderFilter as 'male' | 'female' | 'neutral';
    }

    let filteredVoices = filters.gender
      ? filterCuratedVoices(filters)
      : curatedVoices;

    // Validate voices against ElevenLabs to ensure they still exist
    // This prevents 404 errors when previewing voices that have been deleted
    const { validVoices, removedVoices } = await validateVoicesAgainstElevenLabs(filteredVoices);
    
    if (removedVoices.length > 0) {
      console.warn(`[GET VOICES API] Removed ${removedVoices.length} invalid voice(s):`, removedVoices);
    }
    
    // Use only validated voices
    filteredVoices = validVoices;

    // Transform to response format
    const transformedVoices = filteredVoices.map(voice => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender,
      accent: voice.accent,
      // Note: We don't set language since any voice can speak any language
      ageGroup: voice.ageGroup,
      description: voice.description,
      voiceId: voice.elevenLabsVoiceId || voice.vapiVoiceId, // Generic voiceId (hide source)
      tags: voice.tags,
      tone: voice.tone,
      source: 'raar', // Brand as RAAR (hide 'curated')
      // Keep internal IDs for backend use only
      _internal: {
        source: voice.source,
        elevenLabsVoiceId: voice.elevenLabsVoiceId,
        vapiVoiceId: voice.vapiVoiceId,
      },
    }));

    return NextResponse.json({
      success: true,
      voices: transformedVoices,
      total: transformedVoices.length,
      filters: {
        language: languageFilter || 'all', // Returned for UI reference, but doesn't affect filtering
        gender: genderFilter || 'all',
      },
    });
  } catch (error) {
    console.error('[ERROR] getElevenLabsVoices failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch RAAR Voice Library',
      },
      { status: 500 }
    );
  }
}



