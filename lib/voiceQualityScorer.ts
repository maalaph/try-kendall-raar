/**
 * Voice Quality Scoring & Ranking
 * Scores generated voices and ranks them by quality
 */

export interface VoiceQualityScore {
  overall: number; // 0-100
  clarity: number; // 0-100
  naturalness: number; // 0-100
  accentAccuracy: number; // 0-100
  toneMatch: number; // 0-100
  factors: {
    hasAudioData: boolean;
    audioDataSize: number;
    descriptionQuality: number;
  };
}

export interface ScoredVoice {
  voice: any;
  score: VoiceQualityScore;
}

/**
 * Score a generated voice based on available metadata
 * Since we don't have direct audio analysis, we score based on:
 * - Presence and size of audio data
 * - Description quality and completeness
 * - Voice ID validity
 */
export function scoreVoiceQuality(
  voice: any,
  description: string,
  extractedElements?: any
): VoiceQualityScore {
  let overall = 0;
  let clarity = 50; // Default baseline
  let naturalness = 50; // Default baseline
  let accentAccuracy = 50; // Default baseline
  let toneMatch = 50; // Default baseline

  const factors = {
    hasAudioData: false,
    audioDataSize: 0,
    descriptionQuality: 0,
  };

  // Check audio data presence and size
  if (voice.audioBase64 && typeof voice.audioBase64 === 'string' && voice.audioBase64.length > 0) {
    factors.hasAudioData = true;
    factors.audioDataSize = voice.audioBase64.length;
    
    // Larger audio data generally indicates better quality (more content)
    // Base64 encoding: ~4 chars per 3 bytes, so estimate actual size
    const estimatedSize = (voice.audioBase64.length * 3) / 4;
    
    // Score based on size (typical voice sample is 50-200KB)
    if (estimatedSize > 100000) { // > 100KB
      clarity += 30;
      naturalness += 25;
    } else if (estimatedSize > 50000) { // > 50KB
      clarity += 20;
      naturalness += 15;
    } else if (estimatedSize > 20000) { // > 20KB
      clarity += 10;
      naturalness += 10;
    }
  }

  // Score description quality
  if (description && description.length > 0) {
    const descLength = description.length;
    // Optimal description length is 50-200 characters
    if (descLength >= 50 && descLength <= 200) {
      factors.descriptionQuality = 100;
      overall += 10;
    } else if (descLength >= 30 && descLength <= 300) {
      factors.descriptionQuality = 80;
      overall += 8;
    } else if (descLength >= 20) {
      factors.descriptionQuality = 60;
      overall += 5;
    } else {
      factors.descriptionQuality = 40;
    }
  }

  // Score based on extracted elements (if available)
  if (extractedElements) {
    // More extracted elements = better description = better voice match
    const elementCount = [
      extractedElements.accent,
      extractedElements.gender,
      extractedElements.ageGroup,
      extractedElements.character,
      extractedElements.profession,
    ].filter(Boolean).length;

    if (elementCount >= 4) {
      accentAccuracy += 30;
      toneMatch += 25;
      overall += 15;
    } else if (elementCount >= 3) {
      accentAccuracy += 20;
      toneMatch += 15;
      overall += 10;
    } else if (elementCount >= 2) {
      accentAccuracy += 10;
      toneMatch += 10;
      overall += 5;
    }

    // Specific element bonuses
    if (extractedElements.accent) {
      accentAccuracy += 10;
    }
    if (extractedElements.gender) {
      naturalness += 10;
    }
  }

  // Validate voice ID
  if (voice.generatedVoiceId || voice.id) {
    const voiceId = voice.generatedVoiceId || voice.id;
    // Valid ElevenLabs voice IDs are typically 20+ character alphanumeric strings
    if (typeof voiceId === 'string' && voiceId.length >= 15) {
      overall += 5;
      clarity += 5;
    }
  }

  // Cap all scores at 100
  clarity = Math.min(100, clarity);
  naturalness = Math.min(100, naturalness);
  accentAccuracy = Math.min(100, accentAccuracy);
  toneMatch = Math.min(100, toneMatch);

  // Calculate overall score (weighted average)
  overall = Math.min(100, Math.round(
    (clarity * 0.3) +
    (naturalness * 0.3) +
    (accentAccuracy * 0.2) +
    (toneMatch * 0.2)
  ));

  // Boost overall if we have audio data
  if (factors.hasAudioData) {
    overall = Math.min(100, overall + 10);
  }

  return {
    overall,
    clarity,
    naturalness,
    accentAccuracy,
    toneMatch,
    factors,
  };
}

/**
 * Rank voices by quality score
 * Returns voices sorted by overall score (highest first)
 */
export function rankVoicesByQuality(
  voices: any[],
  description: string,
  extractedElements?: any
): ScoredVoice[] {
  const scoredVoices: ScoredVoice[] = voices.map(voice => ({
    voice,
    score: scoreVoiceQuality(voice, description, extractedElements),
  }));

  // Sort by overall score (descending)
  scoredVoices.sort((a, b) => b.score.overall - a.score.overall);

  return scoredVoices;
}

/**
 * Get top N voices by quality
 */
export function getTopVoicesByQuality(
  voices: any[],
  description: string,
  topN: number = 5,
  extractedElements?: any
): ScoredVoice[] {
  const ranked = rankVoicesByQuality(voices, description, extractedElements);
  return ranked.slice(0, topN);
}












