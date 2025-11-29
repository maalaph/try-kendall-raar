/**
 * Curated Voice Library System
 * Pre-built, high-quality voices mapped to user descriptions
 * Replaces on-the-fly generation with curated library + smart matching
 */

export interface CuratedVoice {
  id: string; // Unique identifier (e.g., "KM-03" or "vapi-elliot")
  name: string; // Display name
  elevenLabsVoiceId?: string; // Voice ID from ElevenLabs (if source is 'elevenlabs')
  vapiVoiceId?: string; // VAPI voice ID (if source is 'vapi')
  source: 'elevenlabs' | 'vapi'; // Voice source
  tags: string[]; // Array of tags (e.g., ["deep", "raspy", "calm"]) - VOICE characteristics only
  accent: string; // Accent type (e.g., "American", "Indian-American", "British")
  gender: 'male' | 'female' | 'neutral';
  ageGroup: 'young' | 'middle-aged' | 'older';
  tone: string[]; // Array of tone descriptors (e.g., ["deep", "raspy"]) - VOICE characteristics only, NOT personality
  description: string; // Human-readable description
  useCases: string[]; // Array of use cases (e.g., ["radio host", "podcast", "narration"])
  languages: string[]; // Supported languages (all voices support all languages, but listed for reference)
  previewAudioUrl?: string; // Optional preview audio URL
  quality: 'high' | 'standard'; // Quality rating: 'high' for ElevenLabs, 'standard' for VAPI
}

/**
 * Curated Voice Library
 * This is the core library of pre-built, high-quality voices
 * Voices are mapped from ElevenLabs library and additional curated voices
 */
export const curatedVoiceLibrary: CuratedVoice[] = [
  // These will be populated by fetching from ElevenLabs API
  // For now, this is a placeholder structure
];

/**
 * Initialize the curated voice library by fetching ElevenLabs voices and adding VAPI voices
 * This should be called on server startup or when needed
 */
export async function initializeVoiceLibrary(): Promise<CuratedVoice[]> {
  // Import VAPI voices
  const { getAllVAPIVoices } = await import('./vapiVoices');
  const vapiVoices = getAllVAPIVoices();
  
  // Convert VAPI voices to CuratedVoice format
  const vapiCuratedVoices: CuratedVoice[] = vapiVoices.map(vapiVoice => ({
    id: vapiVoice.id,
    name: vapiVoice.name,
    vapiVoiceId: vapiVoice.vapiVoiceId,
    source: 'vapi',
    tags: vapiVoice.tags,
    accent: vapiVoice.accent,
    gender: vapiVoice.gender,
    ageGroup: vapiVoice.ageGroup,
    tone: vapiVoice.tags, // Use tags as tone for VAPI voices
    description: vapiVoice.description,
    useCases: ['general'],
    languages: ['en', 'es', 'ar', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi', 'nl', 'pl', 'ru', 'tr'],
    quality: 'standard', // VAPI voices are standard quality
  }));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.warn('[VOICE LIBRARY] ELEVENLABS_API_KEY not found, using empty library');
    return [];
  }

  try {
    // Fetch all available voices from ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      console.error('[VOICE LIBRARY] Failed to fetch voices from ElevenLabs');
      return [];
    }

    const data = await response.json();
    const voices = data.voices || [];

    // Map ElevenLabs voices to curated library format
    const mappedVoices: CuratedVoice[] = voices.map((voice: any) => {
      const gender = (voice.labels?.gender || '').toLowerCase();
      const accent = voice.labels?.accent || '';
      const age = voice.labels?.age || '';
      
      // Extract age group from labels first, then from description if not in labels
      let ageGroup: 'young' | 'middle-aged' | 'older' = 'middle-aged';
      if (age.includes('young')) ageGroup = 'young';
      else if (age.includes('old') || age.includes('elder')) ageGroup = 'older';
      
      // If age not in labels, extract from description (prioritize description over name)
      if (!age || age.trim() === '') {
        const descLower = (voice.description || '').toLowerCase();
        const nameLower = (voice.name || '').toLowerCase();
        // Check description first (more reliable)
        if (descLower.includes('gen z') || descLower.includes('genz') || descLower.includes('20s') || 
            descLower.includes("20's") || descLower.includes('teen') || descLower.includes('teenager') ||
            descLower.includes('youth') || descLower.includes('young') || descLower.includes('college') ||
            descLower.includes('student')) {
          ageGroup = 'young';
        } else if (descLower.includes('millennial') || descLower.includes('gen y') || descLower.includes('30s') ||
                   descLower.includes("30's") || descLower.includes('40s') || descLower.includes("40's") ||
                   descLower.includes('middle-aged') || descLower.includes('middle age')) {
          ageGroup = 'middle-aged';
        } else if (descLower.includes('boomer') || descLower.includes('gen x') || descLower.includes('50s') ||
                   descLower.includes("50's") || descLower.includes('60s') || descLower.includes("60's") ||
                   descLower.includes('70s') || descLower.includes("70's") || descLower.includes('older') ||
                   descLower.includes('old') || descLower.includes('elder') || descLower.includes('senior') ||
                   descLower.includes('aged') || descLower.includes('elderly') || descLower.includes('grandpa') ||
                   descLower.includes('grandma')) {
          ageGroup = 'older';
        }
        // Fallback to name if description doesn't have age info
        else if (nameLower.includes('young') || nameLower.includes('teen') || nameLower.includes('youth')) {
          ageGroup = 'young';
        } else if (nameLower.includes('old') || nameLower.includes('elder') || nameLower.includes('senior') ||
                   nameLower.includes('grandpa') || nameLower.includes('grandma')) {
          ageGroup = 'older';
        }
      }
      
      // Extract tags from description and name
      const nameLower = (voice.name || '').toLowerCase();
      const descLower = (voice.description || '').toLowerCase();
      const fullText = `${nameLower} ${descLower}`;
      
      const tags: string[] = [];
      const tone: string[] = [];
      const useCases: string[] = [];
      
      // Extract common tags - ENHANCED: Better extraction for voice characteristics
      // Timbre characteristics (voice quality)
      if (fullText.includes('deep') || fullText.includes('low-pitched') || fullText.includes('bass') || fullText.includes('baritone')) tags.push('deep');
      if (fullText.includes('raspy') || fullText.includes('rough') || fullText.includes('gravelly') || fullText.includes('hoarse') || fullText.includes('husky') || fullText.includes('gritty')) tags.push('raspy');
      if (fullText.includes('calm') || fullText.includes('relaxed') || fullText.includes('soothing') || fullText.includes('serene')) tags.push('calm');
      if (fullText.includes('warm') || fullText.includes('mellow') || fullText.includes('rich')) tags.push('warm');
      if (fullText.includes('smooth') || fullText.includes('clear') || fullText.includes('crisp') || fullText.includes('clean')) tags.push('smooth');
      if (fullText.includes('bright') || fullText.includes('energetic') || fullText.includes('cheerful') || fullText.includes('lively')) tags.push('bright');
      if (fullText.includes('smoker') || fullText.includes("smoker's") || fullText.includes('smoking')) tags.push('smoker');
      if (fullText.includes('soft') || fullText.includes('gentle')) tags.push('soft');
      if (fullText.includes('powerful') || fullText.includes('strong') || fullText.includes('resonant')) tags.push('powerful');
      
      // Tone characteristics (personality/voice style) - ENHANCED extraction
      // More comprehensive tone extraction for better matching
      if (fullText.includes('professional') || fullText.includes('business') || fullText.includes('corporate') || fullText.includes('polished')) tone.push('professional');
      if (fullText.includes('friendly') || fullText.includes('warm') || fullText.includes('welcoming') || fullText.includes('kind')) tone.push('friendly');
      if (fullText.includes('confident') || fullText.includes('authoritative') || fullText.includes('assured') || fullText.includes('decisive')) tone.push('confident');
      if (fullText.includes('energetic') || fullText.includes('lively') || fullText.includes('animated') || fullText.includes('vibrant') || fullText.includes('enthusiastic')) tone.push('energetic');
      if (fullText.includes('calm') || fullText.includes('peaceful') || fullText.includes('serene') || fullText.includes('soothing') || fullText.includes('relaxed')) tone.push('calm');
      if (fullText.includes('sassy') || fullText.includes('bold') || fullText.includes('feisty') || fullText.includes('spirited')) tone.push('sassy');
      if (fullText.includes('witty') || fullText.includes('clever') || fullText.includes('humorous') || fullText.includes('sharp')) tone.push('witty');
      if (fullText.includes('smooth') || fullText.includes('mellow')) tone.push('smooth');
      if (fullText.includes('bright') || fullText.includes('cheerful')) tone.push('bright');
      
      // Extract LGBTQ+ characteristics
      if (fullText.includes('gay') || fullText.includes('queer') || fullText.includes('lgbtq') || 
          fullText.includes('homosexual') || fullText.includes('lesbian')) {
        tags.push('lgbtq');
      }
      
      // Extract character types - Enhanced: Better extraction for musician, narrator, etc.
      const characterPattern = /\b(bodybuilder|meathead|detective|sherlock|spy|agent|hero|villain|wizard|warrior|knight|pirate|ninja|rapper|singer|artist|musician|jazz\s+musician|narrator|announcer|host|podcaster|teacher|professor|doctor|nurse|lawyer|judge|attorney|soldier|military|veteran|coach|trainer|instructor)\b/i;
      const characterMatch = fullText.match(characterPattern);
      if (characterMatch) {
        let character = characterMatch[0].toLowerCase();
        // Normalize "jazz musician" to "musician"
        if (character.includes('jazz') && character.includes('musician')) {
          character = 'musician';
        }
        tags.push(character);
      }
      
      // Enhanced: Better use case extraction
      if (fullText.includes('radio') || fullText.includes('host') || fullText.includes('broadcast')) {
        tags.push('radio');
        useCases.push('radio host');
      }
      if (fullText.includes('podcast') || fullText.includes('podcasting')) {
        useCases.push('podcast');
        if (!tags.includes('podcaster')) tags.push('podcaster');
      }
      if (fullText.includes('narration') || fullText.includes('narrator') || fullText.includes('audiobook')) {
        useCases.push('narration');
        if (!tags.includes('narrator')) tags.push('narrator');
      }
      if (fullText.includes('conversational') || fullText.includes('conversation')) {
        useCases.push('conversational');
      }
      if (fullText.includes('music') || fullText.includes('musician') || fullText.includes('jazz')) {
        if (!tags.includes('musician')) tags.push('musician');
        useCases.push('music');
      }
      
      // Use full description from ElevenLabs for better matching
      // Combine name and description for comprehensive matching
      const fullDescription = voice.description 
        ? `${voice.name} ${voice.description}`.trim()
        : `${voice.name} - ${accent ? accent + ' ' : ''}${gender} voice`;
      
      return {
        id: `KM-${voice.voice_id.substring(0, 6).toUpperCase()}`,
        name: voice.name || 'Unknown Voice',
        elevenLabsVoiceId: voice.voice_id,
        source: 'elevenlabs',
        tags: tags.length > 0 ? tags : ['general'],
        accent: accent || 'American',
        gender: gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'neutral',
        ageGroup,
        tone: tone.length > 0 ? tone : ['neutral'],
        description: fullDescription, // Use full description for comprehensive matching
        useCases: useCases.length > 0 ? useCases : ['general'],
        languages: ['en', 'es', 'ar', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi', 'nl', 'pl', 'ru', 'tr'], // All languages supported
        quality: 'high', // ElevenLabs voices are high quality
      };
    });

    // Combine all voices before validation
    const allVoices = [...mappedVoices, ...vapiCuratedVoices];
    
    // Validate voices against ElevenLabs to ensure they all exist
    const { validVoices, removedVoices } = await validateVoicesAgainstElevenLabs(allVoices);
    
    // Store validated voices in library: ElevenLabs voices first (higher quality), then VAPI voices
    curatedVoiceLibrary.length = 0;
    curatedVoiceLibrary.push(...validVoices);
    
    // Enhanced logging: Log voice count and quality distribution
    const validElevenLabsVoices = validVoices.filter(v => v.source === 'elevenlabs');
    const elevenLabsCount = validElevenLabsVoices.length;
    const vapiCount = validVoices.filter(v => v.source === 'vapi').length;
    const totalCount = curatedVoiceLibrary.length;
    const voicesWithTone = validElevenLabsVoices.filter(v => v.tone && v.tone.length > 0 && v.tone[0] !== 'neutral').length;
    
    console.log(`[VOICE LIBRARY] Initialized with ${elevenLabsCount} ElevenLabs voices and ${vapiCount} VAPI voices (total: ${totalCount})`);
    if (removedVoices.length > 0) {
      console.warn(`[VOICE LIBRARY] Removed ${removedVoices.length} invalid voice(s) during initialization`);
    }
    console.log(`[VOICE LIBRARY] Quality distribution: ${elevenLabsCount} high-quality (ElevenLabs), ${vapiCount} standard (VAPI)`);
    console.log(`[VOICE LIBRARY] Voices with personality/tone descriptors: ${voicesWithTone} out of ${elevenLabsCount} ElevenLabs voices`);
    
    // Verify all voices are loaded (should be ~140 ElevenLabs voices)
    if (elevenLabsCount < 100) {
      console.warn(`[VOICE LIBRARY] Warning: Only ${elevenLabsCount} ElevenLabs voices loaded. Expected ~140 voices.`);
    } else {
      console.log(`[VOICE LIBRARY] ✓ Successfully loaded ${elevenLabsCount} validated ElevenLabs voices`);
    }
    
    return curatedVoiceLibrary;
  } catch (error) {
    console.error('[VOICE LIBRARY] Error initializing library:', error);
    return [];
  }
}

/**
 * Validate voices against ElevenLabs API to ensure they still exist
 * Filters out any voices that have been deleted from ElevenLabs
 * Returns only valid voices and logs removed ones
 */
export async function validateVoicesAgainstElevenLabs(
  voices: CuratedVoice[]
): Promise<{ validVoices: CuratedVoice[]; removedVoices: string[] }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.warn('[VOICE VALIDATION] ELEVENLABS_API_KEY not found, skipping validation');
    return { validVoices: voices, removedVoices: [] };
  }

  try {
    // Fetch current voices from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      console.warn('[VOICE VALIDATION] Failed to fetch voices from ElevenLabs, skipping validation');
      return { validVoices: voices, removedVoices: [] };
    }

    const data = await response.json();
    const elevenLabsVoices = data.voices || [];
    
    // Create Set of valid ElevenLabs voice IDs for fast lookup
    const validVoiceIds = new Set<string>(
      elevenLabsVoices.map((v: any) => v.voice_id)
    );

    // Separate ElevenLabs voices from VAPI voices
    const elevenLabsVoicesToValidate = voices.filter(v => v.source === 'elevenlabs' && v.elevenLabsVoiceId);
    const vapiVoices = voices.filter(v => v.source === 'vapi');
    
    // Validate ElevenLabs voices
    const validElevenLabsVoices: CuratedVoice[] = [];
    const removedVoices: string[] = [];
    
    for (const voice of elevenLabsVoicesToValidate) {
      if (voice.elevenLabsVoiceId && validVoiceIds.has(voice.elevenLabsVoiceId)) {
        validElevenLabsVoices.push(voice);
      } else {
        removedVoices.push(`${voice.name} (${voice.id})`);
        console.warn(`[VOICE VALIDATION] Removed voice: ${voice.name} (ID: ${voice.elevenLabsVoiceId || 'missing'}) - not found in ElevenLabs`);
      }
    }
    
    // Combine valid ElevenLabs voices with VAPI voices (VAPI voices don't need validation)
    const validVoices = [...validElevenLabsVoices, ...vapiVoices];
    
    if (removedVoices.length > 0) {
      console.log(`[VOICE VALIDATION] Removed ${removedVoices.length} invalid voice(s) from library`);
    } else {
      console.log(`[VOICE VALIDATION] All ${validElevenLabsVoices.length} ElevenLabs voices are valid`);
    }
    
    return { validVoices, removedVoices };
  } catch (error) {
    console.error('[VOICE VALIDATION] Error validating voices:', error);
    // Fail-safe: return all voices if validation fails
    return { validVoices: voices, removedVoices: [] };
  }
}

/**
 * Get all curated voices
 */
export function getAllCuratedVoices(): CuratedVoice[] {
  return curatedVoiceLibrary;
}

/**
 * Get curated voice by ID
 */
export function getCuratedVoiceById(id: string): CuratedVoice | undefined {
  return curatedVoiceLibrary.find(voice => voice.id === id);
}

/**
 * Get curated voice by ElevenLabs voice ID
 */
export function getCuratedVoiceByElevenLabsId(elevenLabsVoiceId: string): CuratedVoice | undefined {
  return curatedVoiceLibrary.find(voice => voice.elevenLabsVoiceId === elevenLabsVoiceId);
}

/**
 * Add a new curated voice to the library
 * Useful for adding voices created via Voice Design API
 */
export function addCuratedVoice(voice: CuratedVoice): void {
  // Check if voice already exists
  const existing = curatedVoiceLibrary.find(v => v.id === voice.id || v.elevenLabsVoiceId === voice.elevenLabsVoiceId);
  if (existing) {
    console.warn(`[VOICE LIBRARY] Voice ${voice.id} already exists, skipping`);
    return;
  }
  
  curatedVoiceLibrary.push(voice);
  console.log(`[VOICE LIBRARY] Added new curated voice: ${voice.id} - ${voice.name}`);
}

/**
 * Filter curated voices by criteria
 */
export function filterCuratedVoices(filters: {
  accent?: string;
  gender?: 'male' | 'female' | 'neutral';
  ageGroup?: 'young' | 'middle-aged' | 'older';
  tags?: string[];
  tone?: string[];
}): CuratedVoice[] {
  return curatedVoiceLibrary.filter(voice => {
    if (filters.accent && voice.accent.toLowerCase() !== filters.accent.toLowerCase()) {
      return false;
    }
    if (filters.gender && voice.gender !== filters.gender) {
      return false;
    }
    if (filters.ageGroup && voice.ageGroup !== filters.ageGroup) {
      return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some(tag => 
        voice.tags.some(vTag => vTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasTag) return false;
    }
    if (filters.tone && filters.tone.length > 0) {
      const hasTone = filters.tone.some(t => 
        voice.tone.some(vTone => vTone.toLowerCase().includes(t.toLowerCase()))
      );
      if (!hasTone) return false;
    }
    return true;
  });
}

