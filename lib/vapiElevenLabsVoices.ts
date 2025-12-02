/**
 * VAPI ElevenLabs Voices Helper
 * 
 * TypeScript types and helper functions for loading and using
 * VAPI-verified ElevenLabs voices from the generated JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ElevenLabsVoice {
  name: string;
  voiceId: string;
}

export interface VoiceLibraryMetadata {
  fetchedAt: string;
  source: string;
  totalVoices: number;
}

export interface VoiceLibraryData {
  metadata: VoiceLibraryMetadata;
  voices: ElevenLabsVoice[];
}

/**
 * Load VAPI ElevenLabs voices from the JSON file
 * @returns VoiceLibraryData or null if file doesn't exist
 */
export function loadVAPIElevenLabsVoices(): VoiceLibraryData | null {
  try {
    const filePath = path.resolve(process.cwd(), 'lib', 'vapiElevenLabsVoices.json');
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data: VoiceLibraryData = JSON.parse(fileContents);
    return data;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.warn('[VAPI VOICES] vapiElevenLabsVoices.json not found. Run "npm run fetch-vapi-voices" to generate it.');
      return null;
    }
    console.error('[VAPI VOICES] Error loading voices:', error);
    return null;
  }
}

/**
 * Get all VAPI-verified ElevenLabs voices
 * @returns Array of ElevenLabsVoice objects
 */
export function getAllVAPIElevenLabsVoices(): ElevenLabsVoice[] {
  const data = loadVAPIElevenLabsVoices();
  return data?.voices || [];
}

/**
 * Get a voice by its voiceId
 * @param voiceId The voice ID to search for
 * @returns ElevenLabsVoice or undefined if not found
 */
export function getVAPIElevenLabsVoiceById(voiceId: string): ElevenLabsVoice | undefined {
  const voices = getAllVAPIElevenLabsVoices();
  return voices.find(voice => voice.voiceId === voiceId);
}

/**
 * Get a voice by its name (case-insensitive)
 * @param name The voice name to search for
 * @returns ElevenLabsVoice or undefined if not found
 */
export function getVAPIElevenLabsVoiceByName(name: string): ElevenLabsVoice | undefined {
  const voices = getAllVAPIElevenLabsVoices();
  const lowerName = name.toLowerCase();
  return voices.find(voice => voice.name.toLowerCase() === lowerName);
}

/**
 * Get metadata about the voice library
 * @returns VoiceLibraryMetadata or null if file doesn't exist
 */
export function getVAPIElevenLabsVoicesMetadata(): VoiceLibraryMetadata | null {
  const data = loadVAPIElevenLabsVoices();
  return data?.metadata || null;
}

/**
 * Check if a voice ID is in the VAPI-verified list
 * @param voiceId The voice ID to check
 * @returns true if the voice is verified by VAPI
 */
export function isVAPIVerifiedVoice(voiceId: string): boolean {
  return getVAPIElevenLabsVoiceById(voiceId) !== undefined;
}

