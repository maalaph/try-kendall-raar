/**
 * Parse natural language voice descriptions to extract structured attributes
 * Handles various phrasings and formats
 */

export interface ParsedVoiceAttributes {
  language?: 'en' | 'es' | 'ar';
  accent?: string;
  ageGroup?: 'young' | 'middle-aged' | 'older';
  gender?: 'male' | 'female';
  tags?: string[]; // Voice characteristics tags (e.g., "lgbtq", "pirate", etc.)
  character?: string; // Character type (e.g., "pirate", "detective", "wizard")
  // Note: tone and style are personality traits selected in later wizard steps, not voice characteristics
}

/**
 * Parse a natural language voice description
 * Examples:
 * - "Young female with Indian-American accent speaking English"
 * - "Middle-aged male with Mexican-American accent speaking Spanish"
 * - "Older woman with British accent"
 */
/**
 * Comprehensive personality trait blacklist
 * These words describe behavior/personality, NOT voice characteristics
 * They should be filtered out before voice matching
 */
const PERSONALITY_BLACKLIST = [
  // Personality traits
  'friendly', 'happy', 'kind', 'mean', 'funny', 'sarcastic',
  'professional', 'flirty', 'aggressive', 'rude', 'blunt',
  'arrogant', 'sassy', 'witty', 'confident',
  // Behavior descriptors
  'slow', 'fast', 'soft-spoken', 'clear-minded', 'serious',
  'bubbly', 'chill',
  // Context-dependent (remove if describing behavior)
  'energetic', // Only if describing behavior, not voice energy
  'calm', // Only if describing behavior, not voice tone
  'warm', // Only if describing personality, not voice timbre
];

/**
 * Filter personality traits from description
 * Returns cleaned description with only voice characteristics
 */
function filterPersonalityTraits(description: string): string {
  const words = description.split(/\s+/);
  const filtered = words.filter(word => {
    const wordLower = word.toLowerCase().replace(/[.,!?;:]/g, '');
    return !PERSONALITY_BLACKLIST.includes(wordLower);
  });
  return filtered.join(' ');
}

export function parseVoiceDescription(description: string): ParsedVoiceAttributes {
  if (!description || typeof description !== 'string') {
    return {};
  }

  // Filter out personality traits first
  const cleanedDescription = filterPersonalityTraits(description);
  const lowerDesc = cleanedDescription.toLowerCase();
  const attributes: ParsedVoiceAttributes = {};

  // Extract language
  if (lowerDesc.includes('spanish') || lowerDesc.includes('español') || lowerDesc.includes('es-')) {
    attributes.language = 'es';
  } else if (lowerDesc.includes('arabic') || lowerDesc.includes('عربي') || lowerDesc.includes('ar-')) {
    attributes.language = 'ar';
  } else if (lowerDesc.includes('english') || lowerDesc.includes('en-')) {
    attributes.language = 'en';
  }

  // Extract gender and age (some words indicate both)
  // Improved matching for minimal descriptions
  if (lowerDesc.includes('male') || lowerDesc.includes('man') || lowerDesc.includes('guy') || lowerDesc.includes('boy') || lowerDesc.includes('gentleman')) {
    attributes.gender = 'male';
    // "boy" also implies young age
    if (lowerDesc.includes('boy') && !attributes.ageGroup) {
      attributes.ageGroup = 'young';
    }
  } else if (lowerDesc.includes('female') || lowerDesc.includes('woman') || lowerDesc.includes('girl') || lowerDesc.includes('lady') || lowerDesc.includes('miss')) {
    attributes.gender = 'female';
    // "girl" also implies young age
    if (lowerDesc.includes('girl') && !attributes.ageGroup) {
      attributes.ageGroup = 'young';
    }
  }

  // Extract age group (check after gender to avoid overriding "boy"/"girl" inference)
  // Enhanced matching for minimal descriptions + Generation-based age recognition
  // Generation terms
  if (lowerDesc.includes('gen z') || lowerDesc.includes('genz') || lowerDesc.includes('generation z') || 
      lowerDesc.includes('gen-z') || lowerDesc.includes('z generation')) {
    attributes.ageGroup = 'young';
  } else if (lowerDesc.includes('millennial') || lowerDesc.includes('gen y') || lowerDesc.includes('gen-y') || 
             lowerDesc.includes('generation y')) {
    attributes.ageGroup = 'middle-aged';
  } else if (lowerDesc.includes('gen x') || lowerDesc.includes('gen-x') || lowerDesc.includes('generation x')) {
    attributes.ageGroup = 'middle-aged';
  } else if (lowerDesc.includes('boomer') || lowerDesc.includes('baby boomer') || lowerDesc.includes('boomer generation')) {
    attributes.ageGroup = 'older';
  }
  // Age ranges (20s, 30s, etc.)
  else if (lowerDesc.includes('20s') || lowerDesc.includes("20's") || lowerDesc.includes('twenties') || 
           lowerDesc.includes('teen') || lowerDesc.includes('teenager') || lowerDesc.includes('youth') ||
           lowerDesc.includes('young') || lowerDesc.includes('college') || lowerDesc.includes('student')) {
    attributes.ageGroup = 'young';
  } else if (lowerDesc.includes('30s') || lowerDesc.includes("30's") || lowerDesc.includes('thirties') ||
             lowerDesc.includes('40s') || lowerDesc.includes("40's") || lowerDesc.includes('forties') ||
             lowerDesc.includes('middle-aged') || lowerDesc.includes('middle age') || lowerDesc.includes('middle')) {
    attributes.ageGroup = 'middle-aged';
  } else if (lowerDesc.includes('50s') || lowerDesc.includes("50's") || lowerDesc.includes('fifties') ||
             lowerDesc.includes('60s') || lowerDesc.includes("60's") || lowerDesc.includes('sixties') ||
             lowerDesc.includes('70s') || lowerDesc.includes("70's") || lowerDesc.includes('seventies') ||
             lowerDesc.includes('older') || lowerDesc.includes('old') || lowerDesc.includes('elder') || 
             lowerDesc.includes('senior') || lowerDesc.includes('aged') || lowerDesc.includes('elderly') ||
             lowerDesc.includes('grandpa') || lowerDesc.includes('grandma') || lowerDesc.includes('grandfather') ||
             lowerDesc.includes('grandmother')) {
    attributes.ageGroup = 'older';
  }

  // Extract LGBTQ+ characteristics (store as tags, not gender)
  if (!attributes.tags) {
    attributes.tags = [];
  }
  if (lowerDesc.includes('gay') || lowerDesc.includes('queer') || lowerDesc.includes('faggot') || 
      lowerDesc.includes('fag') || lowerDesc.includes('homosexual')) {
    if (!attributes.tags.includes('lgbtq')) {
      attributes.tags.push('lgbtq');
    }
  }
  if (lowerDesc.includes('lesbian') || lowerDesc.includes('lesbo') || lowerDesc.includes('dyke')) {
    if (!attributes.tags.includes('lgbtq')) {
      attributes.tags.push('lgbtq');
    }
  }

  // Extract character types (pirate, detective, wizard, etc.)
  const characterPattern = /\b(bodybuilder|meathead|detective|sherlock|spy|agent|hero|villain|wizard|warrior|knight|pirate|ninja|rapper|singer|artist|musician|narrator|announcer|host|podcaster|teacher|professor|doctor|nurse|lawyer|judge|attorney|soldier|military|veteran|coach|trainer|instructor)\b/i;
  const characterMatch = cleanedDescription.match(characterPattern);
  if (characterMatch) {
    attributes.character = characterMatch[0].toLowerCase();
  }

  // Extract accent - check for compound accents FIRST, then single-word accents
  // This ensures "indian american" is parsed as "Indian-American" not just "Indian"
  // IMPORTANT: Exclude "deep" from accent patterns - it's a timbre, not an accent
  // Check if description has "deep accent" or "deep voice" - "deep" is timbre, not accent
  const hasDeepAccent = /deep\s+accent|deep\s+voice/i.test(cleanedDescription);
  
  const accentPatterns = [
    // Compound accents (check FIRST)
    { pattern: /indian[- ]american|indian american/i, accent: 'Indian-American' },
    { pattern: /mexican[- ]american|mexican american/i, accent: 'Mexican-American' },
    { pattern: /african[- ]american|african american|black/i, accent: 'African-American' },
    { pattern: /asian[- ]american|asian american/i, accent: 'Asian-American' },
    { pattern: /southern[- ]american|southern american/i, accent: 'Southern American' },
    { pattern: /northern[- ]american|northern american/i, accent: 'Northern American' },
    // Regional accents
    { pattern: /north|northern/i, accent: 'Northern' },
    { pattern: /south|southern/i, accent: 'Southern' },
    { pattern: /scottish|scotland|scot/i, accent: 'Scottish' },
    { pattern: /irish|ireland/i, accent: 'Irish' },
    { pattern: /welsh|wales/i, accent: 'Welsh' },
    { pattern: /cockney|london/i, accent: 'Cockney' },
    { pattern: /yorkshire/i, accent: 'Yorkshire' },
    { pattern: /liverpool|scouse/i, accent: 'Liverpool' },
    { pattern: /manchester/i, accent: 'Manchester' },
    { pattern: /texan|texas/i, accent: 'Texan' },
    { pattern: /californian|california/i, accent: 'Californian' },
    { pattern: /new york|nyc/i, accent: 'New York' },
    { pattern: /boston|bostonian/i, accent: 'Boston' },
    // Single-word accents (check AFTER compounds and regional)
    { pattern: /british|uk|england|brit/i, accent: 'British' },
    { pattern: /australian|australia|aussie/i, accent: 'Australian' },
    { pattern: /canadian|canada/i, accent: 'Canadian' },
    { pattern: /indian|india/i, accent: 'Indian' },
    { pattern: /mexican|mexico/i, accent: 'Mexican' },
    { pattern: /spanish|spain/i, accent: 'Spanish' },
    { pattern: /arabic|arab/i, accent: 'Arabic' },
    { pattern: /french|france/i, accent: 'French' },
    { pattern: /german|germany/i, accent: 'German' },
    { pattern: /italian|italy/i, accent: 'Italian' },
    { pattern: /chinese|china/i, accent: 'Chinese' },
    { pattern: /japanese|japan/i, accent: 'Japanese' },
    { pattern: /korean|korea/i, accent: 'Korean' },
    { pattern: /new zealand|kiwi/i, accent: 'New Zealand' },
    { pattern: /south african/i, accent: 'South African' },
    { pattern: /american|usa|us/i, accent: 'American' },
  ];

  for (const { pattern, accent } of accentPatterns) {
    if (pattern.test(cleanedDescription)) {
      // Skip if this would match "deep" as an accent (it's a timbre)
      if (hasDeepAccent && accent.toLowerCase().includes('deep')) {
        continue;
      }
      attributes.accent = accent;
      break; // Take the first match
    }
  }

  // If accent mentioned but not matched, try to extract it
  // BUT exclude "deep" - it's a timbre, not an accent
  if (!attributes.accent && !hasDeepAccent) {
    // Match patterns like "with X accent" or "has X accent" but exclude "deep"
    const accentMatch = lowerDesc.match(/(?:with|has)\s+([a-z\s-]+?)\s+accent/i);
    if (accentMatch && accentMatch[1]) {
      const extractedAccent = accentMatch[1].trim().toLowerCase();
      // Skip if it's "deep" - that's a timbre, not an accent
      if (extractedAccent !== 'deep' && !extractedAccent.includes('deep') && extractedAccent.length > 0 && extractedAccent.length < 30) {
        attributes.accent = extractedAccent
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
  }

  // Clean up tags array (remove empty)
  if (attributes.tags && attributes.tags.length === 0) {
    delete attributes.tags;
  }

  // Note: We do NOT extract tone or style here because:
  // - Tone and style are personality traits selected in later wizard steps (PersonalityTraitCards)
  // - Voice generation should only focus on voice characteristics: accent, gender, age
  // - Personality traits are applied separately when generating previews with the selected voice

  return attributes;
}

/**
 * Score how well a voice matches the parsed attributes
 * Returns a score from 0-100
 */
export function scoreVoiceMatch(
  voice: { language?: string; accent?: string; ageGroup?: string; gender?: string },
  attributes: ParsedVoiceAttributes
): number {
  let score = 0;
  const maxScore = 100;

  // Language match (40 points)
  if (attributes.language) {
    const voiceLang = voice.language?.toLowerCase().substring(0, 2);
    const attrLang = attributes.language.toLowerCase();
    if (voiceLang === attrLang) {
      score += 40;
    } else if (voiceLang?.startsWith(attrLang) || attrLang.startsWith(voiceLang || '')) {
      score += 30; // Partial match (e.g., en-US vs en)
    }
  }

  // Gender match (30 points) - critical match with better handling
  if (attributes.gender && voice.gender) {
    const voiceGender = voice.gender.toLowerCase().trim();
    const attrGender = attributes.gender.toLowerCase().trim();
    
    // Exact match
    if (voiceGender === attrGender) {
      score += 30;
    }
    // Handle variations (e.g., "male" vs "man", "female" vs "woman")
    else if ((voiceGender === 'male' && (attrGender === 'man' || attrGender === 'guy' || attrGender === 'boy')) ||
             (voiceGender === 'female' && (attrGender === 'woman' || attrGender === 'girl' || attrGender === 'lady'))) {
      score += 25; // Close match
    }
  } else if (attributes.gender && !voice.gender) {
    // If gender is requested but voice has no gender label, give partial credit
    // (some voices might not have gender labels)
    score += 10;
  }

  // Accent match (20 points) - more flexible matching with better handling
  if (attributes.accent && voice.accent) {
    const voiceAccent = voice.accent.toLowerCase().trim();
    const attrAccent = attributes.accent.toLowerCase().trim();
    
    // Handle common variations
    const accentVariations: { [key: string]: string[] } = {
      'british': ['uk', 'english', 'england', 'british'],
      'american': ['us', 'usa', 'united states', 'american'],
      'australian': ['australia', 'aussie', 'australian'],
      'canadian': ['canada', 'canadian'],
      'indian': ['india', 'indian'],
      'spanish': ['spain', 'spanish'],
      'french': ['france', 'french'],
      'german': ['germany', 'german'],
      'italian': ['italy', 'italian'],
    };
    
    // Check for variations
    let isVariation = false;
    for (const [key, variations] of Object.entries(accentVariations)) {
      if ((variations.includes(attrAccent) && voiceAccent.includes(key)) ||
          (variations.includes(voiceAccent) && attrAccent.includes(key))) {
        isVariation = true;
        break;
      }
    }
    
    // Exact match
    if (voiceAccent === attrAccent || isVariation) {
      score += 20;
    } 
    // Partial match - check if one contains the other
    else if (voiceAccent.includes(attrAccent) || attrAccent.includes(voiceAccent)) {
      score += 15; // Higher score for partial match
    }
    // Word-based match - check if key words match (e.g., "Indian" in "Indian-American")
    else {
      const voiceWords = voiceAccent.split(/[- ]/);
      const attrWords = attrAccent.split(/[- ]/);
      const matchingWords = voiceWords.filter(word => attrWords.includes(word));
      if (matchingWords.length > 0) {
        score += 10; // Partial word match
      }
    }
  } else if (attributes.accent && !voice.accent) {
    // If accent is requested but voice has no accent, don't penalize too much
    // (some voices might not have accent labels)
    score += 0;
  }

  // Age group match (10 points)
  if (attributes.ageGroup && voice.ageGroup?.toLowerCase() === attributes.ageGroup.toLowerCase()) {
    score += 10;
  }

  // Bonus for multiple attribute matches (encourages comprehensive matching)
  let matchedAttributes = 0;
  if (attributes.gender && voice.gender && voice.gender.toLowerCase() === attributes.gender.toLowerCase()) matchedAttributes++;
  if (attributes.accent && voice.accent) matchedAttributes++;
  if (attributes.ageGroup && voice.ageGroup && voice.ageGroup.toLowerCase() === attributes.ageGroup.toLowerCase()) matchedAttributes++;
  
  // Bonus: +5 points for each additional matched attribute beyond the first
  if (matchedAttributes >= 2) {
    score += (matchedAttributes - 1) * 5; // 2 matches = +5, 3 matches = +10
  }

  return Math.min(score, maxScore); // Cap at maxScore
}


