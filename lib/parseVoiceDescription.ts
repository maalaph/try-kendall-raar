/**
 * Parse natural language voice descriptions to extract structured attributes
 * Handles various phrasings and formats
 * Now supports dynamic matching against actual voice library data
 */

import { CuratedVoice } from './voiceLibrary';

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
 * Extract unique attribute values from voice library
 * Returns all unique accents, genders, and age groups that exist in the library
 */
function extractUniqueAttributesFromLibrary(voices: CuratedVoice[]): {
  accents: Set<string>;
  genders: Set<string>;
  ageGroups: Set<string>;
} {
  const accents = new Set<string>();
  const genders = new Set<string>();
  const ageGroups = new Set<string>();

  for (const voice of voices) {
    if (voice.accent) {
      accents.add(voice.accent.toLowerCase());
    }
    if (voice.gender) {
      genders.add(voice.gender.toLowerCase());
    }
    if (voice.ageGroup) {
      ageGroups.add(voice.ageGroup.toLowerCase());
    }
  }

  return { accents, genders, ageGroups };
}

/**
 * Match search term against library attribute values dynamically
 * Returns the matched attribute value if found, or null
 */
function matchSearchTermToAttribute(
  searchTerm: string,
  attributeValues: Set<string>,
  searchTermLower: string
): string | null {
  // Direct match (case-insensitive)
  for (const attrValue of attributeValues) {
    if (attrValue === searchTermLower) {
      return attrValue;
    }
  }

  // Partial match - check if search term is contained in attribute value or vice versa
  for (const attrValue of attributeValues) {
    if (attrValue.includes(searchTermLower) || searchTermLower.includes(attrValue)) {
      // Return the actual attribute value from library (preserve original casing from first voice)
      return attrValue;
    }
  }

  // Word-based match - split compound attributes and check individual words
  const searchWords = searchTermLower.split(/[- ]+/).filter(w => w.length > 2);
  for (const attrValue of attributeValues) {
    const attrWords = attrValue.split(/[- ]+/).filter(w => w.length > 2);
    // Check if any search word matches any attribute word
    const hasMatchingWord = searchWords.some(searchWord =>
      attrWords.some(attrWord =>
        attrWord === searchWord ||
        attrWord.includes(searchWord) ||
        searchWord.includes(attrWord)
      )
    );
    if (hasMatchingWord) {
      return attrValue;
    }
  }

  return null;
}

/**
 * Get the original attribute value from library (with proper casing)
 * Since we store lowercase in the Set, we need to get the original from a voice
 */
function getOriginalAttributeValue(
  matchedLower: string,
  attributeType: 'accent' | 'gender' | 'ageGroup',
  voices: CuratedVoice[]
): string | null {
  for (const voice of voices) {
    let value: string | undefined;
    if (attributeType === 'accent') value = voice.accent;
    else if (attributeType === 'gender') value = voice.gender;
    else if (attributeType === 'ageGroup') value = voice.ageGroup;

    if (value && value.toLowerCase() === matchedLower) {
      return value;
    }
  }
  return null;
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

export function parseVoiceDescription(
  description: string,
  voices?: CuratedVoice[]
): ParsedVoiceAttributes {
  if (!description || typeof description !== 'string') {
    return {};
  }

  // Filter out personality traits first
  const cleanedDescription = filterPersonalityTraits(description);
  const lowerDesc = cleanedDescription.toLowerCase();
  const attributes: ParsedVoiceAttributes = {};

  // Extract unique attributes from voice library if provided (for dynamic matching)
  let libraryAttributes: { accents: Set<string>; genders: Set<string>; ageGroups: Set<string> } | null = null;
  if (voices && voices.length > 0) {
    libraryAttributes = extractUniqueAttributesFromLibrary(voices);
  }

  // Extract language
  if (lowerDesc.includes('spanish') || lowerDesc.includes('español') || lowerDesc.includes('es-')) {
    attributes.language = 'es';
  } else if (lowerDesc.includes('arabic') || lowerDesc.includes('عربي') || lowerDesc.includes('ar-')) {
    attributes.language = 'ar';
  } else if (lowerDesc.includes('english') || lowerDesc.includes('en-')) {
    attributes.language = 'en';
  }

  // Extract gender - DYNAMIC MATCHING: Check against voice library first
  if (libraryAttributes && libraryAttributes.genders.size > 0) {
    const genderKeywords = ['female', 'male', 'woman', 'man', 'women', 'men', 'girl', 'girls', 'boy', 'boys', 'lady', 'ladies', 'guy', 'guys', 'gentleman', 'miss', 'females', 'males'];
    for (const keyword of genderKeywords) {
      if (lowerDesc.includes(keyword)) {
        const keywordLower = keyword.toLowerCase();
        // Map keywords to standard gender values
        let targetGender: string | null = null;
        if (['female', 'woman', 'women', 'girl', 'girls', 'lady', 'ladies', 'miss', 'females'].includes(keywordLower)) {
          targetGender = 'female';
        } else if (['male', 'man', 'men', 'boy', 'boys', 'guy', 'guys', 'gentleman', 'males'].includes(keywordLower)) {
          targetGender = 'male';
        }
        
        if (targetGender && libraryAttributes.genders.has(targetGender)) {
          attributes.gender = targetGender as 'male' | 'female';
          // "girl" or "boy" also implies young age
          if ((keywordLower === 'girl' || keywordLower === 'girls' || keywordLower === 'boy' || keywordLower === 'boys') && !attributes.ageGroup) {
            attributes.ageGroup = 'young';
          }
          break;
        }
      }
    }
  } else {
    // Fallback to hardcoded matching
    if (lowerDesc.includes('women') || lowerDesc.includes('woman') || lowerDesc.includes('females') || lowerDesc.includes('female') || lowerDesc.includes('girl') || lowerDesc.includes('girls') || lowerDesc.includes('lady') || lowerDesc.includes('ladies') || lowerDesc.includes('miss')) {
      attributes.gender = 'female';
      // "girl" also implies young age
      if ((lowerDesc.includes('girl') || lowerDesc.includes('girls')) && !attributes.ageGroup) {
        attributes.ageGroup = 'young';
      }
    } else if (lowerDesc.includes('men') || lowerDesc.includes('male') || lowerDesc.includes('males') || lowerDesc.includes('man') || lowerDesc.includes('guy') || lowerDesc.includes('guys') || lowerDesc.includes('boy') || lowerDesc.includes('boys') || lowerDesc.includes('gentleman')) {
      attributes.gender = 'male';
      // "boy" also implies young age
      if ((lowerDesc.includes('boy') || lowerDesc.includes('boys')) && !attributes.ageGroup) {
        attributes.ageGroup = 'young';
      }
    }
  }

  // Extract age group - DYNAMIC MATCHING: Check against voice library first
  // (check after gender to avoid overriding "boy"/"girl" inference)
  if (!attributes.ageGroup) {
    if (libraryAttributes && libraryAttributes.ageGroups.size > 0) {
      // Map age keywords to standard age group values
      const ageKeywordMap: { [key: string]: 'young' | 'middle-aged' | 'older' } = {
        // Young
        'young': 'young',
        'teen': 'young',
        'teenager': 'young',
        'youth': 'young',
        'college': 'young',
        'student': 'young',
        '20s': 'young',
        "20's": 'young',
        'twenties': 'young',
        'gen z': 'young',
        'genz': 'young',
        'generation z': 'young',
        'gen-z': 'young',
        'z generation': 'young',
        // Middle-aged
        'middle-aged': 'middle-aged',
        'middle age': 'middle-aged',
        'middle': 'middle-aged',
        '30s': 'middle-aged',
        "30's": 'middle-aged',
        'thirties': 'middle-aged',
        '40s': 'middle-aged',
        "40's": 'middle-aged',
        'forties': 'middle-aged',
        'millennial': 'middle-aged',
        'gen y': 'middle-aged',
        'gen-y': 'middle-aged',
        'generation y': 'middle-aged',
        'gen x': 'middle-aged',
        'gen-x': 'middle-aged',
        'generation x': 'middle-aged',
        // Older
        'older': 'older',
        'old': 'older',
        'elder': 'older',
        'senior': 'older',
        'aged': 'older',
        'elderly': 'older',
        '50s': 'older',
        "50's": 'older',
        'fifties': 'older',
        '60s': 'older',
        "60's": 'older',
        'sixties': 'older',
        '70s': 'older',
        "70's": 'older',
        'seventies': 'older',
        'boomer': 'older',
        'baby boomer': 'older',
        'boomer generation': 'older',
        'grandpa': 'older',
        'grandma': 'older',
        'grandfather': 'older',
        'grandmother': 'older',
      };

      // Check each keyword in the description
      for (const [keyword, ageGroup] of Object.entries(ageKeywordMap)) {
        if (lowerDesc.includes(keyword)) {
          // Verify this age group exists in the library
          if (libraryAttributes.ageGroups.has(ageGroup)) {
            attributes.ageGroup = ageGroup;
            break;
          }
        }
      }
    } else {
      // Fallback to hardcoded matching
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
    }
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

  // Extract accent - DYNAMIC MATCHING: Check against voice library first, then fall back to hardcoded patterns
  // This ensures ANY accent in the library can be matched, not just hardcoded ones
  // IMPORTANT: Exclude "deep" from accent patterns - it's a timbre, not an accent
  const hasDeepAccent = /deep\s+accent|deep\s+voice/i.test(cleanedDescription);
  
  // First, try dynamic matching against voice library (if available)
  if (libraryAttributes && libraryAttributes.accents.size > 0) {
    // SPECIAL CASE: Map latino/latina to Latin American before dynamic matching
    // latina = Latin American accent + female gender
    // latino = Latin American accent + male gender
    if (lowerDesc.includes('latina')) {
      // Check if "Latin American" exists in library first (preferred)
      const matchedAccent = matchSearchTermToAttribute('latin american', libraryAttributes.accents, 'latin american');
      if (matchedAccent && voices) {
        const originalAccent = getOriginalAttributeValue(matchedAccent, 'accent', voices);
        if (originalAccent) {
          attributes.accent = originalAccent;
          attributes.gender = 'female'; // latina is for females
        }
      } else {
        // Fallback to Spanish if Latin American doesn't exist
        if (libraryAttributes.accents.has('spanish')) {
          attributes.accent = 'Spanish';
          attributes.gender = 'female'; // latina is for females
        }
      }
    } else if (lowerDesc.includes('latino')) {
      // Check if "Latin American" exists in library first (preferred)
      const matchedAccent = matchSearchTermToAttribute('latin american', libraryAttributes.accents, 'latin american');
      if (matchedAccent && voices) {
        const originalAccent = getOriginalAttributeValue(matchedAccent, 'accent', voices);
        if (originalAccent) {
          attributes.accent = originalAccent;
          attributes.gender = 'male'; // latino is for males
        }
      } else {
        // Fallback to Spanish if Latin American doesn't exist
        if (libraryAttributes.accents.has('spanish')) {
          attributes.accent = 'Spanish';
          attributes.gender = 'male'; // latino is for males
        }
      }
    }
    
    // Extract words from description and check each against library accents
    if (!attributes.accent) {
      const words = cleanedDescription.split(/\s+/).filter(w => w.length > 2);
      for (const word of words) {
        const wordLower = word.toLowerCase();
        // Skip "deep" - it's a timbre, not an accent
        // Skip "latino" and "latina" - already handled above
        if (wordLower === 'deep' || wordLower === 'latino' || wordLower === 'latina') continue;
        
        const matchedAccent = matchSearchTermToAttribute(word, libraryAttributes.accents, wordLower);
        if (matchedAccent && voices) {
          const originalAccent = getOriginalAttributeValue(matchedAccent, 'accent', voices);
          if (originalAccent) {
            attributes.accent = originalAccent;
            break; // Found a match, use it
          }
        }
      }
    }
    
    // Also check for multi-word accents (e.g., "russian accent", "british voice")
    if (!attributes.accent) {
      const accentPhrases = [
        lowerDesc.match(/([a-z\s-]+?)\s+accent/i),
        lowerDesc.match(/([a-z\s-]+?)\s+voice/i),
        lowerDesc.match(/with\s+([a-z\s-]+?)\s+accent/i),
        lowerDesc.match(/has\s+([a-z\s-]+?)\s+accent/i),
      ].filter(m => m !== null) as RegExpMatchArray[];
      
      for (const match of accentPhrases) {
        if (match && match[1]) {
          const phrase = match[1].trim().toLowerCase();
          if (phrase !== 'deep' && !phrase.includes('deep')) {
            const matchedAccent = matchSearchTermToAttribute(phrase, libraryAttributes.accents, phrase);
            if (matchedAccent && voices) {
              const originalAccent = getOriginalAttributeValue(matchedAccent, 'accent', voices);
              if (originalAccent) {
                attributes.accent = originalAccent;
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // Fallback to hardcoded patterns if dynamic matching didn't find anything
  if (!attributes.accent) {
    const accentPatterns = [
      // SPECIAL CASE: latino/latina map to Latin American with gender (check FIRST)
      // latina = Latin American accent + female gender
      // latino = Latin American accent + male gender
      { pattern: /\blatina\b/i, accent: 'Latin American', gender: 'female' },
      { pattern: /\blatino\b/i, accent: 'Latin American', gender: 'male' },
      // Compound accents (check AFTER latino/latina)
      { pattern: /indian[- ]american|indian american/i, accent: 'Indian-American' },
      { pattern: /mexican[- ]american|mexican american/i, accent: 'Mexican-American' },
      { pattern: /latin american|latino american|latina american/i, accent: 'Latin American' },
      { pattern: /african[- ]american|african american|black/i, accent: 'African-American' },
      { pattern: /asian[- ]american|asian american/i, accent: 'Asian-American' },
      // CRITICAL: Compound African accents BEFORE any US/regional patterns
      // (prevents "South African" from being parsed as generic "Southern" or "US Southern")
      { pattern: /south african/i, accent: 'South African' },
      { pattern: /nigerian|nigeria/i, accent: 'Nigerian' },
      // South Asian countries (check BEFORE generic "Indian" and "Asian" patterns)
      { pattern: /pakistani|pakistan/i, accent: 'Pakistani' },
      { pattern: /bangladeshi|bangladesh/i, accent: 'Bangladeshi' },
      { pattern: /sri lankan|sri lanka/i, accent: 'Sri Lankan' },
      { pattern: /southern[- ]american|southern american|us southern/i, accent: 'Southern American' },
      { pattern: /northern[- ]american|northern american/i, accent: 'Northern American' },
      // Regional accents (generic patterns - check AFTER compound accents)
      // CRITICAL: Only match standalone "south" or "southern", NOT when part of "South African"
      { pattern: /\bnorth\b|\bnorthern\b/i, accent: 'Northern' },
      { pattern: /\bsouth\b(?!\s+african)|\bsouthern\b(?!\s+american)/i, accent: 'Southern' },
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
      { pattern: /indian|india/i, accent: 'Indian' }, // Check AFTER Pakistani/Bangladeshi patterns
      { pattern: /mexican|mexico/i, accent: 'Mexican' },
      { pattern: /spanish|spain|spanish american|español/i, accent: 'Spanish' },
      { pattern: /\blatin\b/i, accent: 'Latin American' }, // Only match standalone "latin", not "latino"/"latina"
      { pattern: /arabic|arab|middle eastern/i, accent: 'Arabic' },
      { pattern: /french|france/i, accent: 'French' },
      { pattern: /german|germany/i, accent: 'German' },
      { pattern: /italian|italy/i, accent: 'Italian' },
      { pattern: /vietnamese|vietnam/i, accent: 'Vietnamese' },
      { pattern: /thai|thailand/i, accent: 'Thai' },
      { pattern: /filipino|philippines|philippine/i, accent: 'Filipino' },
      { pattern: /indonesian|indonesia/i, accent: 'Indonesian' },
      { pattern: /malaysian|malaysia/i, accent: 'Malaysian' },
      { pattern: /chinese|china/i, accent: 'Chinese' },
      { pattern: /japanese|japan/i, accent: 'Japanese' },
      { pattern: /korean|korea/i, accent: 'Korean' },
      { pattern: /new zealand|kiwi/i, accent: 'New Zealand' },
      { pattern: /asian|asia/i, accent: 'Asian' }, // Broader Asian pattern (East/Southeast Asian) - check AFTER specific Asian countries
      { pattern: /african|africa/i, accent: 'African' }, // Broader African pattern (should match Nigerian, South African, etc.) - check AFTER specific African countries
      { pattern: /american|usa|us/i, accent: 'American' },
      { pattern: /russian|russia/i, accent: 'Russian' },
      { pattern: /ukrainian|ukranian|ukraine/i, accent: 'Ukrainian' }, // Added Ukrainian (handles both spellings)
      { pattern: /polish|poland/i, accent: 'Polish' },
      { pattern: /czech|czecho/i, accent: 'Czech' },
      { pattern: /hungarian|hungary/i, accent: 'Hungarian' },
      { pattern: /romanian|romania/i, accent: 'Romanian' },
      { pattern: /bulgarian|bulgaria/i, accent: 'Bulgarian' },
      { pattern: /serbian|serbia/i, accent: 'Serbian' },
      { pattern: /croatian|croatia/i, accent: 'Croatian' },
      { pattern: /eastern european|eastern europe/i, accent: 'Eastern European' },
    ];

    for (const patternEntry of accentPatterns) {
      const { pattern, accent, gender: patternGender } = patternEntry as { pattern: RegExp; accent: string; gender?: 'male' | 'female' };
      if (pattern.test(cleanedDescription)) {
        // Skip if this would match "deep" as an accent (it's a timbre)
        if (hasDeepAccent && accent.toLowerCase().includes('deep')) {
          continue;
        }
        attributes.accent = accent;
        // Set gender if pattern specifies it (e.g., latina = female, latino = male)
        if (patternGender && !attributes.gender) {
          attributes.gender = patternGender;
        }
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


