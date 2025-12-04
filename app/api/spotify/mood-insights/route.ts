import { NextRequest, NextResponse } from 'next/server';
import { inferCurrentMood, analyzeTimeBasedPatterns, saveMoodPatterns } from '@/lib/spotify/moodAnalysis';

export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    const updatePatterns = request.nextUrl.searchParams.get('updatePatterns') === 'true';

    // Get current mood
    const currentMood = await inferCurrentMood(recordId);

    // Get time-based patterns
    const patterns = await analyzeTimeBasedPatterns(recordId);

    // Save patterns if requested
    if (updatePatterns) {
      await saveMoodPatterns(recordId, patterns);
    }

    return NextResponse.json({
      success: true,
      currentMood: {
        mood: currentMood.mood,
        confidence: currentMood.confidence,
        reasoning: currentMood.reasoning,
      },
      patterns: {
        morning: {
          energy: patterns.morning.energy,
          valence: patterns.morning.valence,
          tempo: patterns.morning.tempo,
        },
        afternoon: {
          energy: patterns.afternoon.energy,
          valence: patterns.afternoon.valence,
          tempo: patterns.afternoon.tempo,
        },
        evening: {
          energy: patterns.evening.energy,
          valence: patterns.evening.valence,
          tempo: patterns.evening.tempo,
        },
        night: {
          energy: patterns.night.energy,
          valence: patterns.night.valence,
          tempo: patterns.night.tempo,
        },
      },
    });
  } catch (error: any) {
    console.error('[SPOTIFY API] Mood insights error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get mood insights' },
      { status: 500 }
    );
  }
}



