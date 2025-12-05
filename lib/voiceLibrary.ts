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
 * ElevenLabs voice IDs confirmed to fail when routed through Vapi.
 * We exclude them from the curated library so users never see unusable voices.
 */
const UNSUPPORTED_ELEVENLABS_VOICE_IDS = new Set<string>([
  '0FLxgjNYHJnHnNQ3nwk8',
  '0mDYz2rpzUksQMbNcdCc',
  '1a0nAYA3FcNQcMMfbddY',
  '8WRfTpaUoqZSfTerOXzI',
  'DQLhorDHb2d4HkZj4kFd',
  'GoGUcAZovo4MFeLxJdZd',
  'GsfuR3Wo2BACoxELWyEF',
  'Gsndh0O5AnuI2Hj3YUlA',
  'KEVRa7mtDwmBo6pi4ItL',
  'KleDBQ7etYG6NMjnQ9Jw',
  'L5zW3PqYZoWAeS4J1qMV',
  'LeKjR2H906hH45YTS8O5',
  'M5t0724ORuAGCh3p3DUR',
  'MKlLqCItoCkvdhrxgtLv',
  'QF9HJC7XWnue5c9W3LkY',
  'RO2BvjCY3XHTRsIYByXn',
  'Sq93GQT4X1lKDXsQcixO',
  'U0W3edavfdI8ibPeeteQ',
  'Wz5VyMwarjxJoceKovDZ',
  'XagEPz76kWQQ0RWKvQAf',
  'XjdmlV0OFXfXE6Mg2Sb7',
  'XsmrVB66q3D4TaXVaWNF',
  'cgLpYGyXZhkyalKZ0xeZ',
  'dOZwtV72qwiKnZGSlLsC',
  'dOdGri2hgsKdUEaU09Ct',
  'eZm9vdjYgL9PZKtf7XMM',
  'ee2pDOfqzj2pBerZvUCH',
  'efGTHf4ukBiG4n8lptfp',
  'm3yAHyFEFKtbCIM5n7GF',
  'mEHuKdn0uRQSMynXjRNO',
  'nTMUXLFSfbWmdKKy7nDC',
  'nlyULslzTRhqlyv46oPj',
  'nzeAacJi50IvxcyDnMXa',
  'ocZQ262SsZb9RIxcQBOj',
  'u0REnIJvUgcGQYW2Ux8K',
  'wFOtYWBAKv6z33WjceQa',
  'wNl2YBRc8v5uIcq6gOxd',
  'xYWUvKNK6zWCgsdAK7Wi',
  'zYcjlYFOd3taleS0gkk3',
  'zZeq6FndupLBP33ngh9e',
  'zhqwEJnIn9nJv0L8nUkS',
  'ztnpYzQJyWffPj1VC5Uw',
]);

/**
 * Curate a diverse subset of voices ensuring variety in gender, accent, age, and tone
 * @param voices Array of voices to curate from
 * @param maxVoices Maximum number of voices to return (default: 500)
 * @returns Curated array with diversity
 */
function curateDiverseVoices(voices: any[], maxVoices: number = 500): any[] {
  // First, deduplicate voices by voice_id to ensure no duplicates
  const uniqueVoicesMap = new Map<string, any>();
  for (const voice of voices) {
    const voiceId = voice.voice_id || voice.id || voice.voiceId;
    if (voiceId) {
      // Normalize to string and use as key
      const normalizedId = String(voiceId).trim();
      if (normalizedId && !uniqueVoicesMap.has(normalizedId)) {
        uniqueVoicesMap.set(normalizedId, voice);
      }
    }
  }
  const deduplicatedVoices = Array.from(uniqueVoicesMap.values());
  
  if (deduplicatedVoices.length !== voices.length) {
    console.log(`[VOICE CURATION] Removed ${voices.length - deduplicatedVoices.length} duplicate voices`);
  }
  
  if (deduplicatedVoices.length <= maxVoices) {
    return deduplicatedVoices;
  }

  console.log(`[VOICE CURATION] Curating ${maxVoices} diverse voices from ${deduplicatedVoices.length} unique voices...`);

  // Group voices by key characteristics for diversity
  const byGender: Record<string, any[]> = { male: [], female: [], neutral: [] };
  const byAccent: Record<string, any[]> = {};
  const byAge: Record<string, any[]> = { young: [], 'middle-aged': [], older: [] };
  
  // Categorize voices
  for (const voice of deduplicatedVoices) {
    const gender = (voice.labels?.gender || 'neutral').toLowerCase();
    const accent = voice.labels?.accent || 'American';
    const age = voice.labels?.age || '';
    
    // Gender
    if (gender === 'male') byGender.male.push(voice);
    else if (gender === 'female') byGender.female.push(voice);
    else byGender.neutral.push(voice);
    
    // Accent
    if (!byAccent[accent]) byAccent[accent] = [];
    byAccent[accent].push(voice);
    
    // Age
    if (age.includes('young')) byAge.young.push(voice);
    else if (age.includes('old') || age.includes('elder')) byAge.older.push(voice);
    else byAge['middle-aged'].push(voice);
  }

  const curated: any[] = [];
  const used = new Set<string>();
  
  // Strategy: Ensure representation from each category
  const targetPerGender = Math.floor(maxVoices / 3);
  const targetPerAge = Math.floor(maxVoices / 3);
  
  // First pass: Ensure gender diversity (roughly equal distribution)
  for (const gender of ['male', 'female', 'neutral'] as const) {
    const available = byGender[gender].filter(v => !used.has(v.voice_id));
    const take = Math.min(targetPerGender, available.length);
    // Shuffle and take diverse selection
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, take);
    selected.forEach(v => {
      curated.push(v);
      used.add(v.voice_id);
    });
  }
  
  // Second pass: Ensure age diversity
  for (const age of ['young', 'middle-aged', 'older'] as const) {
    const available = byAge[age].filter(v => !used.has(v.voice_id));
    const take = Math.min(targetPerAge, available.length);
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, take);
    selected.forEach(v => {
      if (!used.has(v.voice_id)) {
        curated.push(v);
        used.add(v.voice_id);
      }
    });
  }
  
  // Third pass: Ensure accent diversity (at least 2-3 per accent)
  const accents = Object.keys(byAccent).sort();
  const remainingSlots = maxVoices - curated.length;
  const perAccent = Math.max(2, Math.floor(remainingSlots / Math.max(1, accents.length)));
  
  for (const accent of accents) {
    const available = byAccent[accent].filter(v => !used.has(v.voice_id));
    if (available.length > 0 && curated.length < maxVoices) {
      const take = Math.min(perAccent, available.length, maxVoices - curated.length);
      const shuffled = available.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, take);
      selected.forEach(v => {
        if (!used.has(v.voice_id) && curated.length < maxVoices) {
          curated.push(v);
          used.add(v.voice_id);
        }
      });
    }
  }
  
  // Fill remaining slots with random diverse voices
  const remaining = maxVoices - curated.length;
  if (remaining > 0) {
    const available = deduplicatedVoices.filter(v => !used.has(v.voice_id));
    const shuffled = available.sort(() => Math.random() - 0.5);
    const random = shuffled.slice(0, remaining);
    random.forEach(v => {
      if (!used.has(v.voice_id)) {
        curated.push(v);
        used.add(v.voice_id);
      }
    });
  }
  
  // Final deduplication and shuffle for better distribution
  const finalMap = new Map<string, any>();
  for (const voice of curated) {
    const voiceId = voice.voice_id || voice.id || voice.voiceId;
    if (voiceId) {
      // Normalize to string and use as key
      const normalizedId = String(voiceId).trim();
      if (normalizedId && !finalMap.has(normalizedId)) {
        finalMap.set(normalizedId, voice);
      }
    }
  }
  const final = Array.from(finalMap.values())
    .sort(() => Math.random() - 0.5)
    .slice(0, maxVoices);
  
  if (final.length !== curated.length) {
    console.log(`[VOICE CURATION] Removed ${curated.length - final.length} duplicate voices from final set`);
  }
  
  // Log diversity stats
  const finalByGender: Record<string, number> = { male: 0, female: 0, neutral: 0 };
  const finalByAccent: Record<string, number> = {};
  const finalByAge: Record<string, number> = { young: 0, 'middle-aged': 0, older: 0 };
  
  for (const voice of final) {
    const gender = (voice.labels?.gender || 'neutral').toLowerCase();
    const accent = voice.labels?.accent || 'American';
    const age = voice.labels?.age || '';
    
    if (gender === 'male') finalByGender.male++;
    else if (gender === 'female') finalByGender.female++;
    else finalByGender.neutral++;
    
    finalByAccent[accent] = (finalByAccent[accent] || 0) + 1;
    
    if (age.includes('young')) finalByAge.young++;
    else if (age.includes('old') || age.includes('elder')) finalByAge.older++;
    else finalByAge['middle-aged']++;
  }
  
  console.log(`[VOICE CURATION] Curated ${final.length} voices with diversity:`);
  console.log(`[VOICE CURATION] - Gender: ${finalByGender.male} male, ${finalByGender.female} female, ${finalByGender.neutral} neutral`);
  console.log(`[VOICE CURATION] - Age: ${finalByAge.young} young, ${finalByAge['middle-aged']} middle-aged, ${finalByAge.older} older`);
  console.log(`[VOICE CURATION] - Accents: ${Object.keys(finalByAccent).length} different accents`);
  
  return final;
}

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

  // Load VAPI-verified ElevenLabs voices from JSON file
  let verifiedElevenLabsVoiceIds: Set<string> = new Set();
  try {
    const { getAllVAPIElevenLabsVoices } = await import('./vapiElevenLabsVoices');
    const verifiedVoices = getAllVAPIElevenLabsVoices();
    verifiedElevenLabsVoiceIds = new Set(verifiedVoices.map(v => v.voiceId));
    console.log(`[VOICE LIBRARY] Loaded ${verifiedVoices.length} VAPI-verified ElevenLabs voices from vapiElevenLabsVoices.json`);
  } catch (error) {
    console.warn('[VOICE LIBRARY] Could not load VAPI-verified ElevenLabs voices. Run "npm run fetch-vapi-voices" to generate the file.');
    console.warn('[VOICE LIBRARY] Will include all ElevenLabs voices (not filtered to VAPI-verified only)');
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.warn('[VOICE LIBRARY] ELEVENLABS_API_KEY not found, using empty library');
    return [];
  }

  try {
    // Fetch voices from ElevenLabs with pagination
    // Continue fetching until we have enough verified voices OR checked enough pages
    let allElevenLabsVoices: any[] = [];
    let verifiedVoicesFound: any[] = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    const MIN_VERIFIED_VOICES = 1500; // Minimum to curate 500 diverse voices
    const MAX_PAGES = 100; // Check up to 100 pages to find verified voices

    console.log('[VOICE LIBRARY] Fetching voices from ElevenLabs (will continue until we have enough verified voices)...');

    while (hasMore && page <= MAX_PAGES) {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices?page=${page}&page_size=${pageSize}`, {
        headers: { 'xi-api-key': apiKey },
      });

      if (!response.ok) {
        if (page === 1) {
          console.error('[VOICE LIBRARY] Failed to fetch voices from ElevenLabs');
          return [];
        } else {
          // If we've already fetched some pages, stop here
          console.log(`[VOICE LIBRARY] Reached end of pagination at page ${page}`);
          break;
        }
      }

      const data = await response.json();
      const voices = data.voices || [];
      
      if (voices.length === 0) {
        hasMore = false;
      } else {
        allElevenLabsVoices.push(...voices);
        
        // Filter to verified voices as we go
        if (verifiedElevenLabsVoiceIds.size > 0) {
          const verifiedInPage = voices.filter((voice: any) => verifiedElevenLabsVoiceIds.has(voice.voice_id));
          verifiedVoicesFound.push(...verifiedInPage);
        } else {
          // If no verification list, treat all as verified
          verifiedVoicesFound.push(...voices);
        }
        
        console.log(`[VOICE LIBRARY] Page ${page}: ${voices.length} voices (${verifiedVoicesFound.length} verified so far)`);
        
        // Stop if we have enough verified voices AND we've checked at least 10 pages
        if (verifiedVoicesFound.length >= MIN_VERIFIED_VOICES && page >= 10) {
          console.log(`[VOICE LIBRARY] Reached target of ${MIN_VERIFIED_VOICES} verified voices after ${page} pages. Stopping fetch.`);
          hasMore = false;
          break;
        }
        
        // Check if there's more
        if (data.has_more === false || voices.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`[VOICE LIBRARY] Total voices fetched from ElevenLabs: ${allElevenLabsVoices.length}`);
    console.log(`[VOICE LIBRARY] Total verified voices found: ${verifiedVoicesFound.length}`);

    // Use the verified voices we collected during fetching
    // If we have a verification list, use only verified voices; otherwise use all fetched
    const voicesToProcess = verifiedElevenLabsVoiceIds.size > 0
      ? verifiedVoicesFound
      : allElevenLabsVoices;

    if (verifiedElevenLabsVoiceIds.size > 0) {
      console.log(`[VOICE LIBRARY] Using ${voicesToProcess.length} VAPI-verified ElevenLabs voices (fetched ${allElevenLabsVoices.length} total)`);
    } else {
      console.log(`[VOICE LIBRARY] Using ${voicesToProcess.length} voices (no verification list - all voices)`);
    }

    // CURATE: Select diverse subset of 200-500 voices for performance
    // Only use VAPI-verified voices, ensure variety, NO DUPLICATES
    const MAX_VOICES = 500;
    const curatedVoices = curateDiverseVoices(voicesToProcess, MAX_VOICES);
    console.log(`[VOICE LIBRARY] Curated ${curatedVoices.length} diverse voices from ${voicesToProcess.length} verified voices`);

    const curatedVoicesFiltered = curatedVoices.filter((voice: any) => {
      const voiceId = voice.voice_id || voice.id || voice.voiceId;
      return voiceId ? !UNSUPPORTED_ELEVENLABS_VOICE_IDS.has(String(voiceId).trim()) : true;
    });

    if (curatedVoicesFiltered.length !== curatedVoices.length) {
      console.log(
        `[VOICE LIBRARY] Removed ${curatedVoices.length - curatedVoicesFiltered.length} unsupported ElevenLabs voices (Vapi rejects these IDs)`
      );
    }

    // Map curated voices to library format
    const mappedVoices: CuratedVoice[] = curatedVoicesFiltered.map((voice: any) => {
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
    
    // Deduplicate by voice ID before validation
    const uniqueVoicesMap = new Map<string, CuratedVoice>();
    for (const voice of allVoices) {
      const voiceId = voice.elevenLabsVoiceId || voice.vapiVoiceId || voice.id;
      if (voiceId && !uniqueVoicesMap.has(voiceId)) {
        uniqueVoicesMap.set(voiceId, voice);
      }
    }
    const deduplicatedVoices = Array.from(uniqueVoicesMap.values());
    
    if (deduplicatedVoices.length !== allVoices.length) {
      console.log(`[VOICE LIBRARY] Removed ${allVoices.length - deduplicatedVoices.length} duplicate voices before validation`);
    }
    
    // Validate voices against ElevenLabs to ensure they all exist
    const { validVoices, removedVoices } = await validateVoicesAgainstElevenLabs(deduplicatedVoices);
    
    // Final deduplication after validation (in case validation creates duplicates)
    const finalUniqueMap = new Map<string, CuratedVoice>();
    for (const voice of validVoices) {
      const voiceId = voice.elevenLabsVoiceId || voice.vapiVoiceId || voice.id;
      if (voiceId && !finalUniqueMap.has(voiceId)) {
        finalUniqueMap.set(voiceId, voice);
      }
    }
    const finalUniqueVoices = Array.from(finalUniqueMap.values());
    
    if (finalUniqueVoices.length !== validVoices.length) {
      console.log(`[VOICE LIBRARY] Removed ${validVoices.length - finalUniqueVoices.length} duplicate voices after validation`);
    }
    
    // Store validated voices in library: ElevenLabs voices first (higher quality), then VAPI voices
    curatedVoiceLibrary.length = 0;
    curatedVoiceLibrary.push(...finalUniqueVoices);
    
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

