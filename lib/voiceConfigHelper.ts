/**
 * Helper to convert voice selection to VAPI voice configuration
 * Handles both ElevenLabs and VAPI native voices
 */

import { getElevenLabsMapping } from './voiceMapping';
import { getCuratedVoiceById, initializeVoiceLibrary, getAllCuratedVoices } from './voiceLibrary';

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
  
  // Ensure voice library is initialized before looking up voices
  let curatedVoices = getAllCuratedVoices();
  if (curatedVoices.length === 0) {
    curatedVoices = await initializeVoiceLibrary();
  }
  
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
  
  // IMPORTANT: Check for ElevenLabs ID BEFORE assuming it's a VAPI voice name
  // ElevenLabs voice IDs are typically 17-20 characters, alphanumeric, no dashes
  // VAPI voice names are short (usually < 15 chars) and may contain spaces/dashes
  const isElevenLabsId = trimmedChoice.length >= 15 && 
                         trimmedChoice.length <= 25 && 
                         /^[a-zA-Z0-9]+$/.test(trimmedChoice) &&
                         !trimmedChoice.includes('-') &&
                         !trimmedChoice.includes(' ');
                         
  if (isElevenLabsId) {
    return {
      provider: '11labs',
      voiceId: trimmedChoice,
    };
  }
  
  // If no mapping found and not an ElevenLabs ID, assume it's a VAPI voice name
  // VAPI voice names are simple strings like "Elliot", "Leah", etc.
  if (trimmedChoice.length > 0 && !trimmedChoice.includes('-')) {
    return {
      provider: 'vapi',
      voiceId: trimmedChoice,
    };
  }
  
  // Unknown format - return undefined
  console.warn('[VOICE CONFIG] Unknown voice choice format:', trimmedChoice);
  return undefined;
}





