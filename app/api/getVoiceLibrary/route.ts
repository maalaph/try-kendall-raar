import { NextRequest, NextResponse } from 'next/server';
import { initializeVoiceLibrary, getAllCuratedVoices, filterCuratedVoices } from '@/lib/voiceLibrary';

/**
 * Get curated voice library
 * Supports filtering by language, gender, accent
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize library if needed
    let curatedVoices = getAllCuratedVoices();
    if (curatedVoices.length === 0) {
      curatedVoices = await initializeVoiceLibrary();
    }

    // Get filter parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const languageFilter = searchParams.get('language'); // 'en', 'es', 'ar', or 'all'
    const genderFilter = searchParams.get('gender'); // 'male', 'female', or 'all'
    const accentFilter = searchParams.get('accent'); // Specific accent or 'all'

    // Apply filters
    const filters: {
      gender?: 'male' | 'female' | 'neutral';
      accent?: string;
    } = {};

    if (genderFilter && genderFilter !== 'all') {
      filters.gender = genderFilter as 'male' | 'female' | 'neutral';
    }

    if (accentFilter && accentFilter !== 'all') {
      filters.accent = accentFilter;
    }

    const filteredVoices = filters.gender || filters.accent
      ? filterCuratedVoices(filters)
      : curatedVoices;

    // Transform to response format
    const voices = filteredVoices.map(voice => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender,
      accent: voice.accent,
      ageGroup: voice.ageGroup,
      description: voice.description,
      tags: voice.tags,
      tone: voice.tone,
      useCases: voice.useCases,
      languages: voice.languages,
      elevenLabsVoiceId: voice.elevenLabsVoiceId,
      elevenLabsName: voice.name,
      source: 'curated',
    }));

    return NextResponse.json({
      success: true,
      voices,
      total: voices.length,
      filters: {
        language: languageFilter || 'all', // Returned for UI reference
        gender: genderFilter || 'all',
        accent: accentFilter || 'all',
      },
    });
  } catch (error) {
    console.error('[ERROR] getVoiceLibrary failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch voice library',
      },
      { status: 500 }
    );
  }
}













