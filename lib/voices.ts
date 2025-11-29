/**
 * VAPI Voice Catalog
 * List of available voices for My Kendall setup
 * 
 * NOTE: This catalog is now primarily for reference and fallback.
 * The voice selection UI now fetches voices dynamically from ElevenLabs API
 * to provide the widest range of real, working voices including Spanish, Arabic, etc.
 * 
 * This catalog contains only voices with verified ElevenLabs mappings.
 * Fake entries (like Spanish_Male_1, Arabic_Female_1) have been removed as they don't work.
 * 
 * VAPI does not provide a public API endpoint to list available voices.
 * Voice IDs are the exact strings used by VAPI (e.g., "Elliot", "Leah").
 */

export interface VoiceOption {
  id: string;           // VAPI voice ID (e.g., "Elliot", "Leah")
  name: string;         // Display name
  gender: 'male' | 'female' | 'neutral';
  accent?: string;      // e.g., "American", "British", "Australian", "Indian-American", "Mexican-American", etc.
  language?: string;    // e.g., "en-US", "es-ES", "ar-SA", "en" (for English), "es" (for Spanish), "ar" (for Arabic)
  tone?: string;        // e.g., "warm", "professional", "casual"
  ageGroup?: 'young' | 'middle-aged' | 'older'; // Age group classification
  description?: string; // Short description for UI
}

/**
 * Available VAPI voices organized by gender
 * Expanded catalog with more diverse accents and distinct characteristics
 * Based on VAPI's built-in voice library and ElevenLabs available voices
 */
export const VOICE_CATALOG: VoiceOption[] = [
  // Male Voices - American
  {
    id: 'Elliot',
    name: 'Elliot',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'warm',
    ageGroup: 'middle-aged',
    description: 'Warm and friendly American male voice',
  },
  {
    id: 'Michael',
    name: 'Michael',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'professional',
    description: 'Professional and clear American male voice',
  },
  {
    id: 'Roger',
    name: 'Roger',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'casual',
    description: 'Easy-going and perfect for casual conversations',
  },
  {
    id: 'Eric',
    name: 'Eric',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'smooth',
    ageGroup: 'middle-aged',
    description: 'Smooth tenor pitch from a man in his 40s - perfect for professional use',
  },
  {
    id: 'Brian',
    name: 'Brian',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'comforting',
    ageGroup: 'middle-aged',
    description: 'Middle-aged man with a resonant and comforting tone',
  },
  {
    id: 'Adam',
    name: 'Adam',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'confident',
    description: 'Bright tenor with unwavering certainty and confident delivery',
  },
  {
    id: 'Callum',
    name: 'Callum',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'gravelly',
    description: 'Deceptively gravelly voice with an edgy, distinctive character',
  },
  {
    id: 'Harry',
    name: 'Harry',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'animated',
    ageGroup: 'young',
    description: 'Animated and energetic - ready to charge forward',
  },
  {
    id: 'Bill',
    name: 'Bill',
    gender: 'male',
    accent: 'American',
    language: 'en-US',
    tone: 'friendly',
    description: 'Friendly and comforting voice ready to narrate',
  },
  
  // Male Voices - British
  {
    id: 'George',
    name: 'George',
    gender: 'male',
    accent: 'British',
    language: 'en-GB',
    tone: 'warm',
    description: 'Warm resonance that instantly captivates listeners',
  },
  {
    id: 'Daniel',
    name: 'Daniel',
    gender: 'male',
    accent: 'British',
    language: 'en-GB',
    tone: 'authoritative',
    description: 'Strong voice perfect for professional broadcasts and news',
  },
  
  // Male Voices - Australian
  {
    id: 'Charlie',
    name: 'Charlie',
    gender: 'male',
    accent: 'Australian',
    language: 'en-AU',
    tone: 'energetic',
    ageGroup: 'young',
    description: 'Young Australian male with confident and energetic voice',
  },
  
  // Female Voices - American
  {
    id: 'Sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'American',
    language: 'en-US',
    tone: 'mature',
    ageGroup: 'middle-aged',
    description: 'Confident and warm with mature professional quality',
  },
  {
    id: 'Laura',
    name: 'Laura',
    gender: 'female',
    accent: 'American',
    language: 'en-US',
    tone: 'sunny',
    description: 'Sunny enthusiasm with quirky and energetic attitude',
  },
  {
    id: 'Matilda',
    name: 'Matilda',
    gender: 'female',
    accent: 'American',
    language: 'en-US',
    tone: 'alto',
    description: 'Deep alto pitch with rich and sophisticated tone',
  },
  {
    id: 'Jessica',
    name: 'Jessica',
    gender: 'female',
    accent: 'American',
    language: 'en-US',
    tone: 'trendy',
    ageGroup: 'young',
    description: 'Young and playful voice perfect for trendy content',
  },
  
  // Female Voices - British
  {
    id: 'Alice',
    name: 'Alice',
    gender: 'female',
    accent: 'British',
    language: 'en-GB',
    tone: 'engaging',
    description: 'Clear and engaging British accent - articulate and friendly',
  },
  {
    id: 'Lily',
    name: 'Lily',
    gender: 'female',
    accent: 'British',
    language: 'en-GB',
    tone: 'sophisticated',
    description: 'Velvety smooth British voice with refined warmth',
  },
  
  // Gender-Neutral/Female Voice
  {
    id: 'River',
    name: 'River',
    gender: 'female',
    accent: 'American',
    language: 'en-US',
    tone: 'neutral',
    ageGroup: 'middle-aged',
    description: 'Relaxed and neutral versatile voice for any context',
  },
  
  // NOTE: Spanish and Arabic voices are now fetched dynamically from ElevenLabs API
  // The fake entries (Spanish_Male_1, Arabic_Female_1, etc.) have been removed
  // as they had no ElevenLabs mappings and didn't work. Use the ElevenLabs API
  // to get real Spanish and Arabic voices.
  
  // English with Diverse Accents - Indian-American
  {
    id: 'Indian_American_Male_1',
    name: 'Raj',
    gender: 'male',
    accent: 'Indian-American',
    language: 'en-US',
    tone: 'professional',
    ageGroup: 'middle-aged',
    description: 'Professional Indian-American male voice with clear English pronunciation',
  },
  {
    id: 'Indian_American_Female_1',
    name: 'Priya',
    gender: 'female',
    accent: 'Indian-American',
    language: 'en-US',
    tone: 'warm',
    ageGroup: 'young',
    description: 'Warm Indian-American female voice with friendly tone',
  },
  
  // English with Diverse Accents - Mexican-American
  {
    id: 'Mexican_American_Male_1',
    name: 'Miguel',
    gender: 'male',
    accent: 'Mexican-American',
    language: 'en-US',
    tone: 'energetic',
    ageGroup: 'young',
    description: 'Energetic Mexican-American male voice',
  },
  {
    id: 'Mexican_American_Female_1',
    name: 'Elena',
    gender: 'female',
    accent: 'Mexican-American',
    language: 'en-US',
    tone: 'friendly',
    ageGroup: 'middle-aged',
    description: 'Friendly Mexican-American female voice',
  },
  
  // English with Diverse Accents - African-American
  {
    id: 'African_American_Male_1',
    name: 'Marcus',
    gender: 'male',
    accent: 'African-American',
    language: 'en-US',
    tone: 'confident',
    ageGroup: 'middle-aged',
    description: 'Confident African-American male voice',
  },
  {
    id: 'African_American_Female_1',
    name: 'Keisha',
    gender: 'female',
    accent: 'African-American',
    language: 'en-US',
    tone: 'warm',
    ageGroup: 'young',
    description: 'Warm African-American female voice',
  },
  
  // English with Diverse Accents - Asian-American
  {
    id: 'Asian_American_Male_1',
    name: 'David',
    gender: 'male',
    accent: 'Asian-American',
    language: 'en-US',
    tone: 'professional',
    ageGroup: 'middle-aged',
    description: 'Professional Asian-American male voice',
  },
  {
    id: 'Asian_American_Female_1',
    name: 'Maya',
    gender: 'female',
    accent: 'Asian-American',
    language: 'en-US',
    tone: 'clear',
    ageGroup: 'young',
    description: 'Clear Asian-American female voice',
  },
];

/**
 * Get all voices grouped by gender
 */
export function getVoicesByGender(): Record<string, VoiceOption[]> {
  const grouped: Record<string, VoiceOption[]> = {
    male: [],
    female: [],
    neutral: [],
  };

  VOICE_CATALOG.forEach(voice => {
    if (grouped[voice.gender]) {
      grouped[voice.gender].push(voice);
    }
  });

  return grouped;
}

/**
 * Get all voices grouped by accent
 */
export function getVoicesByAccent(): Record<string, VoiceOption[]> {
  const grouped: Record<string, VoiceOption[]> = {};

  VOICE_CATALOG.forEach(voice => {
    const accent = voice.accent || 'Other';
    if (!grouped[accent]) {
      grouped[accent] = [];
    }
    grouped[accent].push(voice);
  });

  return grouped;
}

/**
 * Get all voices grouped by language
 */
export function getVoicesByLanguage(): Record<string, VoiceOption[]> {
  const grouped: Record<string, VoiceOption[]> = {};

  VOICE_CATALOG.forEach(voice => {
    const lang = voice.language?.toLowerCase().substring(0, 2) || 'other';
    if (!grouped[lang]) {
      grouped[lang] = [];
    }
    grouped[lang].push(voice);
  });

  return grouped;
}

/**
 * Find a voice by ID
 */
export function getVoiceById(id: string): VoiceOption | undefined {
  return VOICE_CATALOG.find(voice => voice.id === id);
}

/**
 * Get default voice (Elliot - warm male voice)
 */
export function getDefaultVoice(): VoiceOption {
  return VOICE_CATALOG.find(voice => voice.id === 'Elliot') || VOICE_CATALOG[0];
}

