/**
 * Helper to convert voice selection to VAPI voice configuration
 * Handles both ElevenLabs and VAPI native voices
 */

import { getElevenLabsMapping } from './voiceMapping';
import { getCuratedVoiceById } from './voiceLibrary';

export interface VoiceConfig {
  provider: '11labs' | 'vapi';
  voiceId: string;
}

/**
 * Convert voice selection to VAPI voice configuration
 * @param voiceChoice - Voice ID from curated library (e.g., "KM-ABC123" or "vapi-elliot")
 * @returns Voice configuration for VAPI API
 */
export async function getVoiceConfigForVAPI(voiceChoice: string): Promise<VoiceConfig | undefined> {
  if (!voiceChoice || typeof voiceChoice !== 'string' || !voiceChoice.trim()) {
    return undefined;
  }

  const trimmedChoice = voiceChoice.trim();
  
  // Check if it's a curated voice ID
  const curatedVoice = getCuratedVoiceById(trimmedChoice);
  
  if (curatedVoice) {
    // We have a curated voice - use its source
    if (curatedVoice.source === 'elevenlabs' && curatedVoice.elevenLabsVoiceId) {
      return {
        provider: '11labs',
        voiceId: curatedVoice.elevenLabsVoiceId,
      };
    } else if (curatedVoice.source === 'vapi' && curatedVoice.vapiVoiceId) {
      return {
        provider: 'vapi',
        voiceId: curatedVoice.vapiVoiceId,
      };
    }
  }
  
  // Fallback: Check if it's an ElevenLabs voice ID directly (starts with letters/numbers, no "vapi-" prefix)
  // Or check if it's a VAPI voice name via mapping
  const mapping = getElevenLabsMapping(trimmedChoice);
  if (mapping?.elevenLabsVoiceId) {
    return {
      provider: '11labs',
      voiceId: mapping.elevenLabsVoiceId,
    };
  }
  
  // If no mapping found, assume it's a VAPI voice name
  // VAPI voice names are simple strings like "Elliot", "Leah", etc.
  if (trimmedChoice.length > 0 && !trimmedChoice.includes('-')) {
    return {
      provider: 'vapi',
      voiceId: trimmedChoice,
    };
  }
  
  // If it looks like an ElevenLabs ID (long alphanumeric string)
  if (trimmedChoice.length > 10 && /^[a-zA-Z0-9]+$/.test(trimmedChoice)) {
    return {
      provider: '11labs',
      voiceId: trimmedChoice,
    };
  }
  
  // Unknown format - return undefined
  console.warn('[VOICE CONFIG] Unknown voice choice format:', trimmedChoice);
  return undefined;
}





