/**
 * Mapping between VAPI voice names and ElevenLabs voice IDs
 * This ensures previews match the actual voices used in VAPI agents
 */

export interface VoiceMapping {
  vapiName: string;
  elevenLabsVoiceId?: string; // ElevenLabs voice ID for generating audio
  elevenLabsPreviewUrl?: string; // Direct preview URL (if available)
  elevenLabsName?: string; // ElevenLabs voice name (for reference)
}

/**
 * Mapping of VAPI voice names to ElevenLabs voice information
 * Some voices match exactly (e.g., Sarah, Liam), others need manual mapping
 */
export const VAPI_TO_ELEVENLABS_MAPPING: Record<string, VoiceMapping> = {
  // Male Voices - American
  'Elliot': {
    vapiName: 'Elliot',
    elevenLabsVoiceId: 'CwhRBWXzGAHq8TQ4Fs17', // Roger - closest match
    elevenLabsName: 'Roger',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3',
  },
  'Roger': {
    vapiName: 'Roger',
    elevenLabsVoiceId: 'CwhRBWXzGAHq8TQ4Fs17',
    elevenLabsName: 'Roger',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3',
  },
  'Eric': {
    vapiName: 'Eric',
    elevenLabsVoiceId: 'cjVigY5qzO86Huf0OWal',
    elevenLabsName: 'Eric',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3',
  },
  'Brian': {
    vapiName: 'Brian',
    elevenLabsVoiceId: 'nPczCjzI2devNBz1zQrb',
    elevenLabsName: 'Brian',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzI2devNBz1zQrb/2dd3e72c-4fd3-42f1-93ea-abc5d4e5aa1d.mp3',
  },
  'Adam': {
    vapiName: 'Adam',
    elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    elevenLabsName: 'Adam',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3',
  },
  'Callum': {
    vapiName: 'Callum',
    elevenLabsVoiceId: 'N2lVS1w4EtoT3dr4eOWO',
    elevenLabsName: 'Callum',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3',
  },
  'Harry': {
    vapiName: 'Harry',
    elevenLabsVoiceId: 'SOYHLrjzK2X1ezoPC6cr',
    elevenLabsName: 'Harry',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3',
  },
  'Bill': {
    vapiName: 'Bill',
    elevenLabsVoiceId: 'pqHfZKP75CvOlQylNhV4',
    elevenLabsName: 'Bill',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3',
  },
  
  // Male Voices - British
  'George': {
    vapiName: 'George',
    elevenLabsVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
    elevenLabsName: 'George',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3',
  },
  'Daniel': {
    vapiName: 'Daniel',
    elevenLabsVoiceId: 'onwK4e9ZLuTAKqWW03F9',
    elevenLabsName: 'Daniel',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7eee0236-1a72-4b86-b303-5dcadc007ba9.mp3',
  },
  
  // Male Voices - Australian
  'Charlie': {
    vapiName: 'Charlie',
    elevenLabsVoiceId: 'IKne3meq5aSn9XLyUdCD',
    elevenLabsName: 'Charlie',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3',
  },
  
  // Female Voices - American
  'Sarah': {
    vapiName: 'Sarah',
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    elevenLabsName: 'Sarah',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3',
  },
  'Laura': {
    vapiName: 'Laura',
    elevenLabsVoiceId: 'FGY2WhTYpPnrIDTdsKH5',
    elevenLabsName: 'Laura',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3',
  },
  'Matilda': {
    vapiName: 'Matilda',
    elevenLabsVoiceId: 'XrExE9yKIg1WjnnlVkGX',
    elevenLabsName: 'Matilda',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
  },
  'Jessica': {
    vapiName: 'Jessica',
    elevenLabsVoiceId: 'cgSgspJ2msm6clMCkdW9',
    elevenLabsName: 'Jessica',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3',
  },
  
  // Female Voices - British
  'Alice': {
    vapiName: 'Alice',
    elevenLabsVoiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    elevenLabsName: 'Alice',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3',
  },
  'Lily': {
    vapiName: 'Lily',
    elevenLabsVoiceId: 'pFZP5JQG7iQjIQuC4Bku',
    elevenLabsName: 'Lily',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3',
  },
  
  // Neutral Voice
  'River': {
    vapiName: 'River',
    elevenLabsVoiceId: 'SAz9YHcvj6GT2YYXdXww',
    elevenLabsName: 'River',
    elevenLabsPreviewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3',
  },
};

/**
 * Get ElevenLabs voice mapping for a VAPI voice name
 */
export function getElevenLabsMapping(vapiVoiceName: string): VoiceMapping | null {
  return VAPI_TO_ELEVENLABS_MAPPING[vapiVoiceName] || null;
}

/**
 * Check if a VAPI voice has an ElevenLabs mapping
 */
export function hasMapping(vapiVoiceName: string): boolean {
  return !!VAPI_TO_ELEVENLABS_MAPPING[vapiVoiceName];
}

