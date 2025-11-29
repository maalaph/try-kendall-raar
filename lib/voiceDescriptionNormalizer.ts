/**
 * Voice Description Normalizer
 * Converts ParsedVoiceAttributes to ElevenLabs Voice Design API format
 * Maps natural language descriptions to structured parameters
 */

import { ParsedVoiceAttributes } from './parseVoiceDescription';

export interface NormalizedVoiceParams {
  age?: 'young' | 'young adult' | 'adult' | 'middle-aged' | 'elderly';
  gender?: 'male' | 'female' | 'neutral';
  accent?: string;
  timbre?: 'warm' | 'bright' | 'deep' | 'soft' | 'raspy' | 'smooth';
  style?: 'energetic' | 'calm' | 'neutral';
  pitch?: 'low' | 'medium' | 'high';
  stability?: number; // 0-1
  similarity_boost?: number; // 0-1
}

/**
 * Normalize parsed voice attributes to ElevenLabs Voice Design API format
 */
export function normalizeVoiceDescription(
  attributes: ParsedVoiceAttributes,
  originalDescription?: string
): NormalizedVoiceParams {
  const params: NormalizedVoiceParams = {};

  // Map age group
  if (attributes.ageGroup) {
    switch (attributes.ageGroup) {
      case 'young':
        params.age = 'young adult';
        break;
      case 'middle-aged':
        params.age = 'adult';
        break;
      case 'older':
        params.age = 'elderly';
        break;
      default:
        params.age = 'adult';
    }
  } else {
    params.age = 'adult'; // Default
  }

  // Map gender
  if (attributes.gender) {
    params.gender = attributes.gender;
  } else {
    params.gender = 'neutral'; // Default
  }

  // Map accent (keep as-is, ElevenLabs handles accent strings)
  if (attributes.accent) {
    params.accent = attributes.accent;
  }

  // Extract timbre from original description if available
  // Check for "deep accent" or "deep voice" - "deep" is timbre, not accent
  if (originalDescription) {
    const descLower = originalDescription.toLowerCase();
    // Prioritize "deep" as timbre (especially if it says "deep accent" or "deep voice")
    if (descLower.includes('deep accent') || descLower.includes('deep voice') || 
        (descLower.includes('deep') && !descLower.includes('deeply'))) {
      params.timbre = 'deep';
    } else if (descLower.includes('warm') || descLower.includes('mellow')) {
      params.timbre = 'warm';
    } else if (descLower.includes('bright') || descLower.includes('light')) {
      params.timbre = 'bright';
    } else if (descLower.includes('low') && !descLower.includes('low pitch')) {
      params.timbre = 'deep';
    } else if (descLower.includes('soft') || descLower.includes('gentle')) {
      params.timbre = 'soft';
    } else if (descLower.includes('raspy') || descLower.includes('rough') || descLower.includes('hoarse')) {
      params.timbre = 'raspy';
    } else if (descLower.includes('smooth') || descLower.includes('clear')) {
      params.timbre = 'smooth';
    }
  }

  // Extract style from original description
  if (originalDescription) {
    const descLower = originalDescription.toLowerCase();
    if (descLower.includes('energetic') || descLower.includes('exciting') || descLower.includes('lively')) {
      params.style = 'energetic';
    } else if (descLower.includes('calm') || descLower.includes('relaxed') || descLower.includes('peaceful')) {
      params.style = 'calm';
    } else {
      params.style = 'neutral';
    }
  } else {
    params.style = 'neutral';
  }

  // Extract pitch from original description
  if (originalDescription) {
    const descLower = originalDescription.toLowerCase();
    if (descLower.includes('low') || descLower.includes('deep') || descLower.includes('bass')) {
      params.pitch = 'low';
    } else if (descLower.includes('high') || descLower.includes('bright') || descLower.includes('soprano')) {
      params.pitch = 'high';
    } else {
      params.pitch = 'medium';
    }
  } else {
    params.pitch = 'medium';
  }

  // Set stability and similarity_boost (defaults for good quality)
  params.stability = 0.8;
  params.similarity_boost = 0.7;

  return params;
}

/**
 * Convert normalized params to ElevenLabs Voice Design API format
 * This is the format expected by the /v1/text-to-voice/design endpoint
 * MUST be at least 20 characters (ElevenLabs requirement)
 */
export function formatForElevenLabsAPI(
  params: NormalizedVoiceParams,
  character?: string
): string {
  const parts: string[] = [];

  // Add character FIRST (highest priority for ElevenLabs to understand character voices)
  if (character) {
    parts.push(character);
  }

  if (params.age) {
    parts.push(params.age);
  }
  if (params.gender) {
    parts.push(params.gender);
  }
  if (params.accent) {
    parts.push(params.accent.toLowerCase());
  }
  if (params.timbre) {
    parts.push(params.timbre);
  }
  if (params.style && params.style !== 'neutral') {
    parts.push(params.style);
  }
  if (params.pitch && params.pitch !== 'medium') {
    parts.push(`${params.pitch} pitch`);
  }

  // Build base description
  let description = parts.join(' ') || 'adult neutral voice';
  
  // CRITICAL: Ensure minimum 20 characters (ElevenLabs requirement)
  // Build a comprehensive description that always meets the requirement
  if (description.length < 20) {
    const additions: string[] = [];
    
    // Always add "voice" if not present
    if (!description.includes('voice')) {
      additions.push('voice');
    }
    
    // Add descriptive characteristics to reach 20+ chars
    if (!params.timbre) {
      additions.push('clear');
    }
    if (!params.style || params.style === 'neutral') {
      additions.push('natural');
    }
    
    // If still too short, add more descriptive words
    if ((description + ' ' + additions.join(' ')).length < 20) {
      additions.push('speaking');
    }
    
    // Final safety: if somehow still too short, pad with meaningful words
    let finalDesc = description;
    if (additions.length > 0) {
      finalDesc = `${description} ${additions.join(' ')}`;
    }
    
    // Absolute fallback: ensure we ALWAYS have 20+ characters
    while (finalDesc.length < 20) {
      finalDesc += ' with authentic tone';
      if (finalDesc.length >= 20) break;
    }
    
    description = finalDesc;
  }

  // Return as a natural language description for ElevenLabs
  // ElevenLabs Voice Design API accepts text descriptions, not structured params
  return description.trim();
}

