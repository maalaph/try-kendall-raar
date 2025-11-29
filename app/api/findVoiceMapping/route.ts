import { NextRequest, NextResponse } from 'next/server';
import { VOICE_CATALOG } from '@/lib/voices';

/**
 * Automatically find ElevenLabs voice mappings for VAPI voices
 * Matches by name first, then by gender/accent if no exact match
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not found' },
        { status: 500 }
      );
    }

    // Fetch all ElevenLabs voices
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!elevenLabsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch ElevenLabs voices' },
        { status: elevenLabsResponse.status }
      );
    }

    const elevenLabsData = await elevenLabsResponse.json();
    const elevenLabsVoices = elevenLabsData.voices || [];

    // Create mapping suggestions for each VAPI voice
    const mappings: Array<{
      vapiVoice: string;
      exactMatch?: any;
      suggestedMatches: Array<{ voice: any; score: number; reason: string }>;
    }> = [];

    for (const vapiVoice of VOICE_CATALOG) {
      // Try exact name match
      const exactMatch = elevenLabsVoices.find(
        (v: any) => v.name.toLowerCase() === vapiVoice.name.toLowerCase()
      );

      // Find closest matches by gender and accent
      const suggestedMatches = elevenLabsVoices
        .map((elVoice: any) => {
          let score = 0;
          const reasons: string[] = [];

          // Gender match
          const elGender = elVoice.labels?.gender?.toLowerCase();
          const vapiGender = vapiVoice.gender?.toLowerCase();
          if (elGender === vapiGender) {
            score += 10;
            reasons.push('gender match');
          }

          // Accent match
          const elAccent = elVoice.labels?.accent?.toLowerCase();
          const vapiAccent = vapiVoice.accent?.toLowerCase();
          if (elAccent === vapiAccent || (elAccent === 'american' && vapiAccent === 'american')) {
            score += 5;
            reasons.push('accent match');
          }

          // Name similarity (partial match)
          const nameSimilarity = vapiVoice.name.toLowerCase().includes(elVoice.name.toLowerCase()) ||
            elVoice.name.toLowerCase().includes(vapiVoice.name.toLowerCase());
          if (nameSimilarity && !exactMatch) {
            score += 15;
            reasons.push('name similarity');
          }

          return { voice: elVoice, score, reason: reasons.join(', ') };
        })
        .filter((m: any) => m.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3); // Top 3 suggestions

      mappings.push({
        vapiVoice: vapiVoice.name,
        exactMatch: exactMatch || undefined,
        suggestedMatches: suggestedMatches as any,
      });
    }

    return NextResponse.json({
      success: true,
      mappings,
      note: 'Use exactMatch when available, otherwise use the highest-scoring suggestedMatch',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find mappings' },
      { status: 500 }
    );
  }
}








