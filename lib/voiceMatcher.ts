/**
 * Voice Matching Engine
 * Maps user descriptions to curated voices in the library
 * Uses intelligent scoring to find the best matches
 */

import { CuratedVoice } from './voiceLibrary';
import { parseVoiceDescription, ParsedVoiceAttributes } from './parseVoiceDescription';

/**
 * Regional accent grouping map
 * Groups similar accents that can be used as fallback matches
 * e.g., "Ukrainian" can match "Russian", "Polish" (Eastern European)
 */
const REGIONAL_ACCENT_GROUPS: { [key: string]: string[] } = {
  // Eastern European
  'eastern european': ['russian', 'ukrainian', 'polish', 'czech', 'hungarian', 'romanian', 'bulgarian', 'serbian', 'croatian', 'slovak', 'slovenian'],
  'russian': ['ukrainian', 'polish', 'eastern european'],
  'ukrainian': ['russian', 'polish', 'eastern european'],
  'polish': ['russian', 'ukrainian', 'eastern european'],
  'czech': ['russian', 'ukrainian', 'polish', 'eastern european'],
  'hungarian': ['russian', 'ukrainian', 'polish', 'eastern european'],
  'romanian': ['russian', 'ukrainian', 'polish', 'eastern european'],
  'bulgarian': ['russian', 'ukrainian', 'polish', 'eastern european'],
  'serbian': ['russian', 'ukrainian', 'polish', 'eastern european'],
  'croatian': ['russian', 'ukrainian', 'polish', 'eastern european'],
  
  // Latin American / Spanish variants
  'latin american': ['spanish', 'mexican', 'argentinian', 'colombian', 'chilean', 'venezuelan', 'peruvian', 'latino', 'latina'],
  'spanish': ['latin american', 'mexican'],
  'mexican': ['spanish', 'latin american'],
  'argentinian': ['spanish', 'latin american'],
  'colombian': ['spanish', 'latin american'],
  'latino': ['latin american', 'spanish', 'mexican'],
  'latina': ['latin american', 'spanish', 'mexican'],
  
  // British
  'british': ['irish', 'scottish', 'welsh', 'english'],
  'irish': ['british', 'scottish', 'welsh'],
  'scottish': ['british', 'irish', 'welsh'],
  'welsh': ['british', 'irish', 'scottish'],
  'english': ['british', 'irish', 'scottish', 'welsh'],
  
  // North American (isolated - do NOT match with African "South African")
  'american': ['canadian'],
  'canadian': ['american'],
  'northern american': ['american', 'canadian'],
  'southern american': ['american'], // CRITICAL: Do NOT match with "South African" - different regions
  'us southern': ['southern american', 'american'], // Variant name for Southern American
  
  // Asian
  'chinese': ['mandarin', 'cantonese'],
  'japanese': ['korean'],
  'korean': ['japanese'],
  
  // Middle Eastern / Arab (same group)
  'arabic': ['middle eastern', 'arab'],
  'middle eastern': ['arabic', 'arab'],
  'arab': ['arabic', 'middle eastern'],
  
  // African (includes African-American)
  'african': ['nigerian', 'south african', 'african-american', 'kenyan', 'ghanaian', 'ethiopian', 'tanzanian', 'ugandan', 'zimbabwean'],
  'nigerian': ['african', 'south african', 'african-american'],
  'south african': ['african', 'nigerian', 'african-american'],
  'african-american': ['african', 'nigerian', 'south african'],
  'kenyan': ['african', 'nigerian', 'south african', 'african-american'],
  'ghanaian': ['african', 'nigerian', 'south african', 'african-american'],
  
  // Scandinavian
  'swedish': ['norwegian', 'danish', 'scandinavian'],
  'norwegian': ['swedish', 'danish', 'scandinavian'],
  'danish': ['swedish', 'norwegian', 'scandinavian'],
  'scandinavian': ['swedish', 'norwegian', 'danish'],
};

/**
 * Get similar accents for a given accent (regional grouping)
 */
function getSimilarAccents(accent: string): string[] {
  // Normalize the accent first
  const accentNormalized = normalizeAccent(accent);
  const accentLower = accent.toLowerCase().trim();
  
  // Check normalized accent first
  const similarNormalized = REGIONAL_ACCENT_GROUPS[accentNormalized] || [];
  // Check original accent
  const similar = REGIONAL_ACCENT_GROUPS[accentLower] || [];
  
  // Combine both
  const allSimilar = [...new Set([...similarNormalized, ...similar])];
  
  // Also check reverse mapping (if accent is in a group, return all accents in that group)
  for (const [group, accents] of Object.entries(REGIONAL_ACCENT_GROUPS)) {
    if (accents.includes(accentNormalized) || accents.includes(accentLower)) {
      return [...new Set([...accents, group, ...allSimilar])]; // Include the group name and all accents
    }
  }
  
  return allSimilar;
}

/**
 * Normalize accent names to handle variations (e.g., "US Southern" → "Southern American")
 */
function normalizeAccent(accent: string): string {
  const normalized = accent.toLowerCase().trim();
  
  // Normalize variations
  if (normalized === 'us southern' || normalized === 'us-southern') {
    return 'southern american';
  }
  if (normalized === 'southern us' || normalized === 'southern-us') {
    return 'southern american';
  }
  
  return normalized;
}

/**
 * Explicit exclusion rules to prevent cross-regional matching
 * These accents should NEVER match each other, even if they share words
 */
const ACCENT_EXCLUSIONS: { [key: string]: string[] } = {
  // South African must NOT match any US accents
  'south african': ['southern american', 'us southern', 'us-southern', 'southern', 'american', 'northern american', 'us'],
  'african': ['southern american', 'us southern', 'us-southern', 'southern', 'northern american', 'us'],
  'nigerian': ['southern american', 'us southern', 'us-southern', 'southern', 'american', 'us'],
  'african-american': ['southern american', 'us southern', 'us-southern', 'southern', 'us'],
  
  // US Southern must NOT match African accents (normalized variations)
  'southern american': ['south african', 'african', 'nigerian', 'african-american'],
  'us southern': ['south african', 'african', 'nigerian', 'african-american'],
  'us-southern': ['south african', 'african', 'nigerian', 'african-american'],
  'southern': ['south african', 'african', 'nigerian', 'african-american'], // Generic "Southern" shouldn't match African
  
  // Eastern European must NOT match British
  'ukrainian': ['british', 'irish', 'scottish', 'welsh', 'english'],
  'russian': ['british', 'irish', 'scottish', 'welsh', 'english'],
  'eastern european': ['british', 'irish', 'scottish', 'welsh', 'english'],
};

/**
 * Check if two accents should be explicitly excluded from matching
 */
function areAccentsExcluded(accent1: string, accent2: string): boolean {
  // Normalize both accents before checking exclusions
  const acc1 = normalizeAccent(accent1);
  const acc2 = normalizeAccent(accent2);
  
  // Check exclusion rules (check both normalized and original forms)
  if (ACCENT_EXCLUSIONS[acc1] && ACCENT_EXCLUSIONS[acc1].includes(acc2)) {
    return true;
  }
  if (ACCENT_EXCLUSIONS[acc2] && ACCENT_EXCLUSIONS[acc2].includes(acc1)) {
    return true;
  }
  
  // Also check original forms
  const acc1Original = accent1.toLowerCase().trim();
  const acc2Original = accent2.toLowerCase().trim();
  if (ACCENT_EXCLUSIONS[acc1Original] && ACCENT_EXCLUSIONS[acc1Original].includes(acc2Original)) {
    return true;
  }
  if (ACCENT_EXCLUSIONS[acc2Original] && ACCENT_EXCLUSIONS[acc2Original].includes(acc1Original)) {
    return true;
  }
  
  return false;
}

/**
 * Check if two accents are similar (same regional group or one is similar to the other)
 */
function areAccentsSimilar(accent1: string, accent2: string): boolean {
  // Normalize accents first
  const acc1 = normalizeAccent(accent1);
  const acc2 = normalizeAccent(accent2);
  
  // Check explicit exclusions first - these should NEVER match
  if (areAccentsExcluded(acc1, acc2)) {
    return false;
  }
  
  // Exact match (after normalization)
  if (acc1 === acc2) return true;
  
  // Check if one is similar to the other
  const similar1 = getSimilarAccents(acc1);
  if (similar1.includes(acc2)) return true;
  
  const similar2 = getSimilarAccents(acc2);
  if (similar2.includes(acc1)) return true;
  
  return false;
}

export interface VoiceMatch {
  voice: CuratedVoice;
  score: number;
  matchDetails: {
    accentMatch: boolean;
    genderMatch: boolean;
    ageMatch: boolean;
    tagMatches: string[];
    toneMatches: string[];
    keywordMatches: string[];
  };
}

/**
 * Match user description to curated voices
 * Returns top matches sorted by relevance score
 */
export function matchDescriptionToVoice(
  description: string,
  curatedVoices: CuratedVoice[],
  maxResults: number = 5
): VoiceMatch[] {
  if (!description || !description.trim()) {
    return [];
  }

  if (!curatedVoices || curatedVoices.length === 0) {
    console.warn('[VOICE MATCHER] No curated voices available');
    return [];
  }

  // Parse user description into attributes
  const attributes = parseVoiceDescription(description, curatedVoices);
  const descriptionLower = description.toLowerCase();
  
  // Debug logging to see what was parsed
  console.log(`[VOICE MATCHER] Parsed attributes from "${description}":`, {
    accent: attributes.accent,
    gender: attributes.gender,
    ageGroup: attributes.ageGroup,
  });
  
  // CRITICAL: Validate that parsed attributes actually exist in the voice library
  // If user searches for an accent that doesn't exist, check for similar regional accents
  // This allows "Ukrainian" to match "Russian", "Polish" etc. (Eastern European group)
  if (attributes.accent) {
    // Extract all unique accents from the voice library
    const availableAccents = new Set(
      curatedVoices
        .map(v => v.accent?.toLowerCase().trim())
        .filter((accent): accent is string => !!accent)
    );
    
    const parsedAccentLower = attributes.accent.toLowerCase().trim();
    const accentExists = availableAccents.has(parsedAccentLower);
    
    // Check if exact accent exists or similar regional accent exists
    let hasMatchingAccent = accentExists;
    if (!hasMatchingAccent) {
      // Check for similar accents from the same regional group
      const similarAccents = getSimilarAccents(parsedAccentLower);
      hasMatchingAccent = similarAccents.some(similarAccent => availableAccents.has(similarAccent));
      
      if (hasMatchingAccent) {
        console.log(`[VOICE MATCHER] Accent "${attributes.accent}" not found, but similar regional accent exists. Will use regional matching.`);
        // Don't return empty - allow matching to proceed with regional fallback
      }
    }
    
    if (!hasMatchingAccent) {
      console.log(`[VOICE MATCHER] Accent "${attributes.accent}" not found in voice library and no similar regional accents available. Available accents:`, Array.from(availableAccents));
      console.log(`[VOICE MATCHER] Returning empty results - accent does not exist in library`);
      return []; // Return empty - accent doesn't exist and no similar accents available
    }
    
    // CRITICAL: Verify that at least one voice with this accent or similar accent exists
    const voicesWithAccent = curatedVoices.filter(v => {
      if (!v.accent) return false;
      const voiceAccent = v.accent.toLowerCase().trim();
      return voiceAccent === parsedAccentLower || areAccentsSimilar(voiceAccent, parsedAccentLower);
    });
    
    if (voicesWithAccent.length === 0) {
      console.log(`[VOICE MATCHER] No voices found with accent "${attributes.accent}" or similar regional accents in library. Returning empty results.`);
      return []; // Return empty - no voices with this accent or similar accents exist
    }
  }
  
  // Enhanced keyword extraction: Extract all meaningful words
  const words = descriptionLower.split(/\s+/).filter(w => w.length > 2);
  const stopWords = ['the', 'and', 'with', 'like', 'for', 'from', 'that', 'this', 'has', 'have', 'are', 'was', 'were', 'been', 'being', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'];
  const descriptionKeywords = words.filter(word => !stopWords.includes(word));
  
  // Extract 2-word phrases for better matching (e.g., "laid back", "surfer cool")
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.includes(words[i]) && !stopWords.includes(words[i + 1])) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // Extract 3-word phrases if they exist
  for (let i = 0; i < words.length - 2; i++) {
    if (!stopWords.includes(words[i]) && !stopWords.includes(words[i + 1]) && !stopWords.includes(words[i + 2])) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Pre-filter: Remove voices that don't match critical attributes
  // STRICT: This ensures "old indian american man" only returns voices matching ALL three
  // ENHANCED: Even stricter filtering - exclude ALL voices that don't match critical attributes
  // CRITICAL: For character-specific queries (pirate, detective, etc.), require exact character match
  const preFilteredVoices = curatedVoices.filter(voice => {
    // Character filter: If user specifies a character type, voice MUST have that character
    if (attributes.character) {
      const attrCharacter = attributes.character.toLowerCase();
      const voiceDescLower = voice.description.toLowerCase();
      const voiceTagsLower = voice.tags.map(t => t.toLowerCase());
      
      // Check if voice has the character in tags or description
      const hasCharacter = voiceTagsLower.includes(attrCharacter) || 
                          voiceDescLower.includes(attrCharacter) ||
                          voiceTagsLower.some(tag => tag.includes(attrCharacter)) ||
                          voiceDescLower.includes(attrCharacter);
      
      if (!hasCharacter) {
        return false; // Filter out - doesn't have the required character
      }
    }
    // Age filter: if user specifies age, voice MUST match exactly (no exceptions)
    if (attributes.ageGroup) {
      if (!voice.ageGroup || voice.ageGroup !== attributes.ageGroup) {
        return false; // Filter out - doesn't match required age
      }
    }

    // Gender filter: CRITICAL - if user specifies gender, voice MUST match exactly
    // NEVER return opposite gender - this is a hard requirement
    // STRICT: If user requests a specific gender, ONLY return voices with that exact gender (no neutral fallbacks)
    if (attributes.gender) {
      // If voice has a specific gender, it MUST match exactly
      if (voice.gender && voice.gender !== 'neutral') {
        if (voice.gender !== attributes.gender) {
          console.log(`[VOICE MATCHER] Filtering out voice with wrong gender: ${voice.name} (${voice.gender} vs requested ${attributes.gender})`);
          return false; // CRITICAL: Filter out opposite gender - NEVER return male when female requested or vice versa
        }
      }
      // STRICT: If user explicitly requests a gender, filter out neutral voices too
      // This ensures strict matching like dropdown filters - if user searches "female", show ONLY female voices
      if (voice.gender === 'neutral') {
        console.log(`[VOICE MATCHER] Filtering out neutral voice when specific gender requested: ${voice.name} (requested ${attributes.gender})`);
        return false; // Filter out neutral voices when specific gender is requested
      }
    }

    // Accent filter: Allow exact matches AND regional matches (e.g., Ukrainian matches Russian/Polish)
    // CRITICAL: Explicitly prevent cross-regional matches (e.g., South African ≠ US Southern)
    if (attributes.accent && voice.accent) {
      // Normalize accents for comparison
      const attrAccent = normalizeAccent(attributes.accent);
      const voiceAccent = normalizeAccent(voice.accent);
      const attrAccentOriginal = attributes.accent.toLowerCase().trim();
      const voiceAccentOriginal = voice.accent.toLowerCase().trim();

      // CRITICAL: Check explicit exclusions first - these should NEVER match
      if (areAccentsExcluded(attrAccent, voiceAccent)) {
        console.log(`[VOICE MATCHER] Explicit exclusion: "${attrAccentOriginal}" cannot match "${voiceAccentOriginal}" - filtering out ${voice.name}`);
        return false; // Filter out - explicit exclusion rule
      }

      // Check for exact match first (highest priority) - check both normalized and original
      const exactMatch = voiceAccent === attrAccent || voiceAccentOriginal === attrAccentOriginal;
      
      // Check for regional match (e.g., Ukrainian matches Russian, Polish from Eastern European group)
      // When searching "African", should match Nigerian, South African, African-American, etc.
      const regionalMatch = areAccentsSimilar(voiceAccentOriginal, attrAccentOriginal);
      
      if (!exactMatch && !regionalMatch) {
        // No exact match and no regional match - filter out
        console.log(`[VOICE MATCHER] Filtering out voice with incompatible accent: ${voice.name} (${voice.accent} vs requested ${attributes.accent})`);
        return false; // Filter out - accent doesn't match exactly or regionally
      }
    } else if (attributes.accent && !voice.accent) {
      // User specified accent but voice has no accent - filter out
      return false;
    }

    return true; // Voice passed all filters
  });

  console.log(`[VOICE MATCHER] Pre-filtered ${preFilteredVoices.length} voices from ${curatedVoices.length} (matched critical attributes)`);

  // Score each pre-filtered voice
  const matches: VoiceMatch[] = preFilteredVoices.map(voice => {
    const matchDetails = {
      accentMatch: false,
      genderMatch: false,
      ageMatch: false,
      tagMatches: [] as string[],
      toneMatches: [] as string[],
      keywordMatches: [] as string[],
    };

    let score = 0;
    let nameMatchScore = 0; // Track name match scores separately for 0.5x weighting
    
    // Context-aware keyword matching: Generic words that need age conflict checking
    const genericWords = ['man', 'woman', 'person', 'guy', 'girl', 'boy', 'lady', 'gentleman'];

    // CRITICAL: Apply negative scoring FIRST for mismatches (before positive scoring)
    // This ensures mismatches never rank high, even with keyword matches
    
    // Age mismatch penalty: -200 points (heaviest penalty - age is critical)
    if (attributes.ageGroup && voice.ageGroup) {
      if (voice.ageGroup !== attributes.ageGroup) {
        score -= 200; // Heavy penalty for age mismatch
      }
    }
    
    // Gender mismatch penalty: -10000 points (CRITICAL - should never happen due to pre-filter, but add massive penalty)
    // This ensures that even if pre-filter fails, opposite gender voices get negative scores
    if (attributes.gender && voice.gender && voice.gender !== 'neutral') {
      if (voice.gender !== attributes.gender) {
        score -= 10000; // MASSIVE penalty - opposite gender should NEVER be returned
        console.error('[VOICE MATCHER] CRITICAL: Gender mismatch detected!', {
          requested: attributes.gender,
          voice: voice.gender,
          voiceName: voice.name,
        });
      }
    }
    
    // Accent mismatch penalty: -100 points (heavy penalty - accent is important)
    // But don't penalize regional matches (they'll get positive score later)
    // CRITICAL: Only check exact matches or regional matches - NO partial word matching
    // (prevents "South African" from matching "US Southern" due to shared word "south")
    if (attributes.accent && voice.accent) {
      const attrAccent = attributes.accent.toLowerCase().trim();
      const voiceAccent = voice.accent.toLowerCase().trim();
      const accentMatches = voiceAccent === attrAccent || areAccentsSimilar(voiceAccent, attrAccent);
      if (!accentMatches) {
        score -= 100; // Penalty for accent mismatch (only if not exact or regional match)
      }
    } else if (attributes.accent && !voice.accent) {
      score -= 100; // Penalty if accent specified but voice has none
    }

    // 1. Accent matching (100 points for exact, 75 for regional, 50 for partial, 0 for mismatch)
    // PRIORITIZE LABELS: Accent from ElevenLabs labels is authoritative (3x weight multiplier applied later)
    if (attributes.accent && voice.accent) {
      const attrAccent = attributes.accent.toLowerCase().trim();
      const voiceAccent = voice.accent.toLowerCase().trim();

      // Exact match (highest priority - 100 points)
      if (voiceAccent === attrAccent) {
        score += 100;
        matchDetails.accentMatch = true;
      }
      // Regional match (e.g., Ukrainian matches Russian, Polish from Eastern European group)
      else if (areAccentsSimilar(voiceAccent, attrAccent)) {
        score += 75; // Regional match - good but lower than exact
        matchDetails.accentMatch = true;
        console.log(`[VOICE MATCHER] Regional accent match: "${voiceAccent}" matches "${attrAccent}" (similar regional group)`);
      }
      // If no exact or regional match, don't give any accent score (will be filtered out)
      // Compound accent matching - STRICT: if user wants "Indian-American", voice MUST have both parts
      else if (attrAccent.includes('-') || attrAccent.includes(' ')) {
        const attrWords = attrAccent.split(/[- ]+/).filter(w => w.length > 2);
        const voiceWords = voiceAccent.split(/[- ]+/).filter(w => w.length > 2);
        
        // STRICT: ALL words from user's accent must be present in voice accent
        // "indian-american" requires both "indian" AND "american" in voice
        const allWordsMatch = attrWords.every(attrWord => 
          voiceWords.some(voiceWord => 
            voiceWord === attrWord || 
            voiceWord.includes(attrWord) || 
            attrWord.includes(voiceWord)
          )
        );
        
        if (allWordsMatch) {
          score += 100; // All parts match - perfect match
          matchDetails.accentMatch = true;
        }
        // If not all words match, don't give any points - this is a mismatch
        // This ensures "Indian-American" doesn't match "American" alone
      }
      // REMOVED: Partial word matching causes cross-regional confusion
      // (e.g., "South African" matching "US Southern" because both contain "south")
      // Only exact matches and regional group matches are allowed - no partial matching
    }

    // 2. Gender matching (80 points for exact match)
    // PRIORITIZE LABELS: Gender from ElevenLabs labels is authoritative (3x weight multiplier applied later)
    if (attributes.gender && voice.gender) {
      if (voice.gender === attributes.gender) {
        score += 80; // Base score, will be multiplied by 3x for labels
        matchDetails.genderMatch = true;
      }
    }

  // 3. Age matching (60 points for exact match) - ENHANCED
  // PRIORITIZE LABELS: Age from ElevenLabs labels is authoritative (3x weight multiplier applied later)
  // Enhanced: Better age range matching (65-year-old → older, 20s → young, Gen Z → young, etc.)
  if (attributes.ageGroup && voice.ageGroup) {
    if (voice.ageGroup === attributes.ageGroup) {
      score += 60; // Base score, will be multiplied by 3x for labels
      matchDetails.ageMatch = true;
    }
    // No partial age matching - must be exact (pre-filtering handles this)
  }
  
  // Enhanced: Check description for age keywords if ageGroup not set
  if (!attributes.ageGroup) {
    // Expanded age keyword matching including generation terms
    const ageKeywords = {
      'young': ['20s', "20's", 'teen', 'teenage', 'youth', 'young adult', 'college', 'student', 
                'gen z', 'genz', 'generation z', 'gen-z', 'z generation'],
      'middle-aged': ['30s', "30's", '40s', "40's", 'middle age', 'adult', 'professional age',
                      'millennial', 'gen y', 'gen-y', 'generation y', 'gen x', 'gen-x', 'generation x'],
      'older': ['65-year-old', '60-year-old', '70-year-old', 'elderly', 'old', 'senior', 'aged', 
                '50s', "50's", '60s', "60's", '70s', "70's", 'boomer', 'baby boomer', 'boomer generation',
                'grandpa', 'grandma', 'grandfather', 'grandmother']
    };
    
    for (const [ageGroup, keywords] of Object.entries(ageKeywords)) {
      const hasAgeKeyword = keywords.some(keyword => descriptionLower.includes(keyword));
      if (hasAgeKeyword && voice.ageGroup === ageGroup) {
        score += 45; // Age keyword match
        matchDetails.ageMatch = true;
        break;
      }
    }
  }

  // 4. Tag matching (20 points per matching tag)
  // Enhanced: Better matching for timbre characteristics (deep, raspy, smoker's)
  descriptionKeywords.forEach(keyword => {
    voice.tags.forEach(tag => {
      if (tag.toLowerCase().includes(keyword) || keyword.includes(tag.toLowerCase())) {
        if (!matchDetails.tagMatches.includes(tag)) {
          matchDetails.tagMatches.push(tag);
          // Boost timbre matches (deep, raspy, smoker's) - these are important voice characteristics
          if (['deep', 'raspy', 'gravelly', 'rough', 'smoker', "smoker's", 'hoarse', 'husky'].includes(tag.toLowerCase())) {
            score += 30; // Higher score for timbre matches
          } else {
            score += 20;
          }
        }
      }
    });
  });
  
  // 4c. Timbre-specific matching (check description for timbre words)
  const timbreKeywords = ['deep', 'raspy', 'gravelly', 'rough', 'smoker', "smoker's", 'hoarse', 'husky', 'low-pitched'];
  timbreKeywords.forEach(timbreKeyword => {
    if (descriptionLower.includes(timbreKeyword)) {
      // Check if voice has matching timbre in tags or tone
      const hasTimbre = voice.tags.some(tag => 
        tag.toLowerCase().includes(timbreKeyword) || timbreKeyword.includes(tag.toLowerCase())
      ) || voice.tone.some(tone => 
        tone.toLowerCase().includes(timbreKeyword) || timbreKeyword.includes(tone.toLowerCase())
      );
      if (hasTimbre && !matchDetails.tagMatches.includes(timbreKeyword)) {
        matchDetails.tagMatches.push(timbreKeyword);
        score += 25; // Good score for timbre match
      }
    }
  });

    // 4a. LGBTQ+ tag matching (30 points for LGBTQ+ match)
    if (attributes.tags && attributes.tags.includes('lgbtq')) {
      if (voice.tags.includes('lgbtq')) {
        if (!matchDetails.tagMatches.includes('lgbtq')) {
          matchDetails.tagMatches.push('lgbtq');
          score += 30;
        }
      }
    }

  // 4b. Character matching (200 points for exact match) - CRITICAL: Character queries must be strict
  // If user searches for "pirate", only voices with "pirate" should be returned
  if (attributes.character) {
    const attrCharacter = attributes.character.toLowerCase();
    const voiceDescLower = voice.description.toLowerCase();
    const voiceTagsLower = voice.tags.map(t => t.toLowerCase());
    
    // CRITICAL: Character must be in tags or description (already pre-filtered, but boost score)
    // Exact match in tags gets highest score
    if (voiceTagsLower.includes(attrCharacter)) {
      if (!matchDetails.keywordMatches.includes(attrCharacter)) {
        matchDetails.keywordMatches.push(attrCharacter);
        score += 200; // Massive boost for exact character match in tags
      }
    } 
    // Exact match in description
    else if (voiceDescLower.includes(attrCharacter)) {
      if (!matchDetails.keywordMatches.includes(attrCharacter)) {
        matchDetails.keywordMatches.push(attrCharacter);
        score += 150; // High score for character in description
      }
    }
    // Partial match (word contains character) - lower score but still valid
    else {
      const hasPartialMatch = voiceTagsLower.some(tag => 
        tag.includes(attrCharacter) || attrCharacter.includes(tag)
      ) || voiceDescLower.includes(attrCharacter);
      
      if (hasPartialMatch && !matchDetails.keywordMatches.includes(attrCharacter)) {
        matchDetails.keywordMatches.push(attrCharacter);
        score += 100; // Good score for partial character match
      }
    }
  }

    // 5. Tone matching (30-35 points per matching tone) - ENHANCED for perfect matching
    // CRITICAL DISTINCTION: Voice Search (Vocalize MyKendall) vs Personality Config (Personalize MyKendall)
    // - Voice Search matches VOICE CHARACTERISTICS (how the voice SOUNDS): tone, timbre, energy, sound quality
    //   Examples: "scary", "angry", "energetic" = find voices that SOUND scary/angry/energetic
    //   This matches against voice.tone and voice.tags fields (voice characteristics)
    // - Personality Config affects COMMUNICATION STYLE (word choice, how agent speaks): separate from voice selection
    //   Examples: "scary", "angry", "energetic" = how the agent COMMUNICATES (affects system prompt, not voice model)
    //   This is handled in personality configuration components, NOT in voice search
    // Semantic matching for voice tone characteristics (how it sounds, not personality)
    const toneSynonyms: { [key: string]: string[] } = {
      'warm': ['friendly', 'welcoming', 'kind', 'gentle'],
      'friendly': ['warm', 'welcoming', 'kind', 'approachable'],
      'confident': ['authoritative', 'assured', 'self-assured', 'decisive'],
      'authoritative': ['confident', 'decisive', 'commanding'],
      'professional': ['polished', 'business', 'formal', 'corporate'],
      'energetic': ['lively', 'animated', 'vibrant', 'enthusiastic'],
      'calm': ['peaceful', 'relaxed', 'serene', 'soothing'],
      'sassy': ['bold', 'feisty', 'spirited', 'saucy'],
      'witty': ['clever', 'humorous', 'sharp', 'quick'],
    };

    // Extract voice characteristic keywords from description for better matching
    // NOTE: These are VOICE CHARACTERISTICS (how it sounds), not personality traits (how it communicates)
    const voiceCharacteristicKeywords: string[] = [];
    descriptionKeywords.forEach(keyword => {
      // Check if keyword matches any voice tone directly (voice characteristics - how it sounds)
      voice.tone.forEach(tone => {
        if (tone.toLowerCase().includes(keyword) || keyword.includes(tone.toLowerCase())) {
          if (!matchDetails.toneMatches.includes(tone)) {
            matchDetails.toneMatches.push(tone);
            score += 35; // Increased from 15 to 35 for perfect matching
            voiceCharacteristicKeywords.push(keyword);
          }
        }
      });

      // Check for semantic matches (synonyms) - these are VOICE CHARACTERISTICS, not personality
      for (const [toneKey, synonyms] of Object.entries(toneSynonyms)) {
        if (synonyms.includes(keyword.toLowerCase()) || keyword.toLowerCase() === toneKey) {
          // Check if voice has this tone or any of its synonyms (voice characteristics - how it sounds)
          const hasMatchingTone = voice.tone.some(tone => {
            const toneLower = tone.toLowerCase();
            return toneLower === toneKey || 
                   synonyms.some(syn => toneLower.includes(syn) || syn.includes(toneLower)) ||
                   toneLower.includes(keyword) || keyword.includes(toneLower);
          });
          
          if (hasMatchingTone && !matchDetails.toneMatches.some(t => t.toLowerCase() === toneKey)) {
            matchDetails.toneMatches.push(toneKey);
            score += 30; // Bonus for semantic match
            voiceCharacteristicKeywords.push(keyword);
          }
        }
      }
    });

    // Also check full description for voice characteristic terms not caught by keywords
    // NOTE: These are VOICE CHARACTERISTICS (how it sounds), not personality traits
    // Terms like "scary", "angry", "energetic" in voice search = find voices that SOUND that way
    const voiceCharacteristicTerms = ['confident', 'friendly', 'professional', 'warm', 'energetic', 'calm', 
                              'sassy', 'witty', 'authoritative', 'polished', 'bold', 'feisty', 'scary', 'angry'];
    voiceCharacteristicTerms.forEach(term => {
      if (descriptionLower.includes(term) && !voiceCharacteristicKeywords.includes(term)) {
        const hasMatchingTone = voice.tone.some(tone => {
          const toneLower = tone.toLowerCase();
          return toneLower.includes(term) || term.includes(toneLower) ||
                 (toneSynonyms[term] && toneSynonyms[term].some(syn => toneLower.includes(syn)));
        });
        
        if (hasMatchingTone && !matchDetails.toneMatches.some(t => t.toLowerCase().includes(term))) {
          matchDetails.toneMatches.push(term);
          score += 30; // Bonus for personality match
        }
      }
    });

    // 6. Use case matching (10 points per matching use case)
    descriptionKeywords.forEach(keyword => {
      voice.useCases.forEach(useCase => {
        if (useCase.toLowerCase().includes(keyword) || keyword.includes(useCase.toLowerCase())) {
          if (!matchDetails.keywordMatches.includes(useCase)) {
            matchDetails.keywordMatches.push(useCase);
            score += 10;
          }
        }
      });
    });

    // 7. Voice name matching (REDUCED PRIORITY - labels are more authoritative)
    // Context-aware: Don't match generic words like "man"/"woman" if age conflicts
    let nameMatchCount = 0;
    
    descriptionKeywords.forEach(keyword => {
      const voiceNameLower = voice.name.toLowerCase();
      const voiceDescLower = voice.description.toLowerCase();
      
      // Context-aware matching: Check if generic word conflicts with age
      if (genericWords.includes(keyword)) {
        // Check if voice name/description has conflicting age indicators
        const hasOldAgeIndicator = voiceNameLower.includes('old') || voiceNameLower.includes('elder') ||
                                   voiceNameLower.includes('senior') || voiceNameLower.includes('grandpa') ||
                                   voiceNameLower.includes('grandma') || voiceDescLower.includes('old') ||
                                   voiceDescLower.includes('elder') || voiceDescLower.includes('senior');
        const hasYoungAgeIndicator = voiceNameLower.includes('young') || voiceNameLower.includes('teen') ||
                                     voiceNameLower.includes('youth') || voiceDescLower.includes('young') ||
                                     voiceDescLower.includes('teen') || voiceDescLower.includes('youth');
        
        // Check if user wants young but voice is old (or vice versa)
        const ageConflict = (attributes.ageGroup === 'young' && hasOldAgeIndicator) ||
                           (attributes.ageGroup === 'older' && hasYoungAgeIndicator);
        
        // Skip matching generic words if there's an age conflict
        if (ageConflict) {
          return; // Don't match this keyword
        }
      }
      
      // Exact match (keyword appears as whole word in name)
      if (voiceNameLower === keyword || 
          new RegExp(`\\b${keyword}\\b`, 'i').test(voiceNameLower)) {
        nameMatchScore += 30; // Track separately for 0.5x weighting
        nameMatchCount++;
        if (!matchDetails.keywordMatches.includes(keyword)) {
          matchDetails.keywordMatches.push(keyword);
        }
      }
      // Partial match (keyword appears anywhere in name)
      else if (voiceNameLower.includes(keyword)) {
        nameMatchScore += 15; // Track separately for 0.5x weighting
        nameMatchCount++;
        if (!matchDetails.keywordMatches.includes(keyword)) {
          matchDetails.keywordMatches.push(keyword);
        }
      }
    });
    
    // Bonus for multiple keyword matches in name (reduced, track separately)
    if (nameMatchCount > 1) {
      nameMatchScore += (nameMatchCount - 1) * 10; // Track separately
    }
    
    // Apply 0.5x weight to name matches (less reliable than labels)
    score += nameMatchScore * 0.5;

    // 8. Description text matching (descriptions are more reliable than names, but still less than labels)
    // Context-aware: Apply same age conflict checks as name matching
    let descMatchCount = 0;
    
    descriptionKeywords.forEach(keyword => {
      const voiceDescLower = voice.description.toLowerCase();
      
      // Context-aware matching: Check if generic word conflicts with age
      if (genericWords.includes(keyword)) {
        const hasOldAgeIndicator = voiceDescLower.includes('old') || voiceDescLower.includes('elder') ||
                                   voiceDescLower.includes('senior') || voiceDescLower.includes('grandpa') ||
                                   voiceDescLower.includes('grandma');
        const hasYoungAgeIndicator = voiceDescLower.includes('young') || voiceDescLower.includes('teen') ||
                                     voiceDescLower.includes('youth');
        
        const ageConflict = (attributes.ageGroup === 'young' && hasOldAgeIndicator) ||
                           (attributes.ageGroup === 'older' && hasYoungAgeIndicator);
        
        if (ageConflict) {
          return; // Don't match this keyword
        }
      }
      
      // Exact match (keyword appears as whole word in description)
      // Apply 0.5x weight - descriptions are better than names but labels are still authoritative
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(voiceDescLower)) {
        if (!matchDetails.keywordMatches.includes(keyword)) {
          matchDetails.keywordMatches.push(keyword);
          score += 20 * 0.5; // Apply 0.5x weight directly - labels are more authoritative
          descMatchCount++;
        }
      }
      // Partial match
      else if (voiceDescLower.includes(keyword)) {
        if (!matchDetails.keywordMatches.includes(keyword)) {
          matchDetails.keywordMatches.push(keyword);
          score += 10 * 0.5; // Apply 0.5x weight directly - labels are more authoritative
          descMatchCount++;
        }
      }
    });
    
    // Bonus for multiple keyword matches in description (reduced, apply 0.5x weight)
    if (descMatchCount > 1) {
      score += (descMatchCount - 1) * 7 * 0.5; // Apply 0.5x weight
    }

    // 9. Phrase matching (check multi-word phrases) - REDUCED priority
    phrases.forEach(phrase => {
      const voiceNameLower = voice.name.toLowerCase();
      const voiceDescLower = voice.description.toLowerCase();
      
      // Context check for phrases too
      const hasAgeConflict = (attributes.ageGroup === 'young' && 
                              (voiceNameLower.includes('old') || voiceNameLower.includes('elder') ||
                               voiceDescLower.includes('old') || voiceDescLower.includes('elder'))) ||
                             (attributes.ageGroup === 'older' &&
                              (voiceNameLower.includes('young') || voiceNameLower.includes('teen') ||
                               voiceDescLower.includes('young') || voiceDescLower.includes('teen')));
      
      if (hasAgeConflict && (phrase.includes('man') || phrase.includes('woman') || phrase.includes('person'))) {
        return; // Skip phrase match if age conflicts
      }
      
      // Phrase match in name (reduced priority, apply 0.5x weight)
      if (voiceNameLower.includes(phrase)) {
        score += 15 * 0.5; // Apply 0.5x weight directly - labels are more authoritative
        if (!matchDetails.keywordMatches.includes(phrase)) {
          matchDetails.keywordMatches.push(phrase);
        }
      }
      // Phrase match in description (apply 0.5x weight)
      else if (voiceDescLower.includes(phrase)) {
        score += 10 * 0.5; // Apply 0.5x weight directly - labels are more authoritative
        if (!matchDetails.keywordMatches.includes(phrase)) {
          matchDetails.keywordMatches.push(phrase);
        }
      }
    });

    return {
      voice,
      score,
      matchDetails,
    };
  });

  // Apply multi-factor scoring weights: Critical attributes get 3x boost
  // PRIORITIZE LABELS: ElevenLabs labels (gender, age, accent) are authoritative
  // Note: Name/description matches already have 0.5x weight applied during scoring
  const weightedMatches = matches.map(match => {
    let weightedScore = match.score;
    
    // Calculate critical attribute base scores (from sections 1-3)
    // These are the authoritative labels from ElevenLabs
    const criticalAttributeScore = 
      (match.matchDetails.accentMatch ? 100 : 0) +
      (match.matchDetails.genderMatch ? 80 : 0) +
      (match.matchDetails.ageMatch ? 60 : 0);
    
    // Boost critical attributes: add 2x more (since 1x is already in score)
    // This gives us 3x total weight for critical attributes (labels are authoritative)
    weightedScore += criticalAttributeScore * 2;
    
    // Quality boost: ElevenLabs voices are higher quality - prioritize curated library
    if (match.voice.source === 'elevenlabs' && match.voice.quality === 'high') {
      weightedScore += 25; // Quality boost
    }
    // VAPI voices stay at base score (no boost)
    
    return {
      ...match,
      score: weightedScore,
    };
  });

  // Filter out negative scores and low confidence matches
  // CONFIDENCE THRESHOLD: Only return matches with score > 0 (after penalties)
  // If best match has score < 50, it's a poor match
  const positiveMatches = weightedMatches.filter(match => match.score > 0);
  
  if (positiveMatches.length === 0) {
    console.log('[VOICE MATCHER] No matches with positive score after penalties');
    return []; // No good matches found
  }
  
  // Sort by score (descending), then by quality (ElevenLabs first)
  const sortedMatches = positiveMatches.sort((a, b) => {
    // Primary sort: score (descending)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary sort: quality (ElevenLabs first)
    if (a.voice.quality === 'high' && b.voice.quality === 'standard') {
      return -1; // ElevenLabs first
    }
    if (a.voice.quality === 'standard' && b.voice.quality === 'high') {
      return 1; // ElevenLabs first
    }
    return 0;
  });
  
  // CONFIDENCE THRESHOLD: Check if best match is above threshold
  // CRITICAL: For character-specific queries, require much higher confidence
  const bestMatch = sortedMatches[0];
  const hasCharacterQuery = attributes.character && attributes.character.length > 0;
  
  // Higher threshold for character queries (pirate, detective, etc.)
  const confidenceThreshold = hasCharacterQuery ? 150 : 50; // 150 for character queries, 50 for general
  
  if (bestMatch.score < confidenceThreshold) {
    console.log(`[VOICE MATCHER] Best match score (${bestMatch.score}) below threshold (${confidenceThreshold}). ${hasCharacterQuery ? 'Character query requires higher confidence.' : 'Suggesting voice generation instead.'}`);
    // Return empty array to trigger fallback to generation
    return [];
  }
  
  // Log confidence levels for debugging
  console.log(`[VOICE MATCHER] Top match score: ${bestMatch.score}, confidence: ${bestMatch.score >= confidenceThreshold ? 'HIGH' : 'LOW'}, character query: ${hasCharacterQuery}`);
  
  // CRITICAL: For character queries, only return top 3-5 most relevant matches
  // For general queries, return up to maxResults
  const maxResultsForCharacter = 5;
  const actualMaxResults = hasCharacterQuery ? Math.min(maxResults, maxResultsForCharacter) : maxResults;
  
  // Return top matches (fewer for character queries to ensure relevance)
  return sortedMatches.slice(0, actualMaxResults);
}

/**
 * Find the best matching voice for a description
 * Returns the top match or null if no good match found
 */
export function findBestMatch(
  description: string,
  curatedVoices: CuratedVoice[],
  minScore: number = 50
): VoiceMatch | null {
  const matches = matchDescriptionToVoice(description, curatedVoices, 1);
  
  if (matches.length === 0 || matches[0].score < minScore) {
    return null;
  }
  
  return matches[0];
}

