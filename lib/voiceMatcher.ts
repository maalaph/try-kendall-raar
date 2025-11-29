/**
 * Voice Matching Engine
 * Maps user descriptions to curated voices in the library
 * Uses intelligent scoring to find the best matches
 */

import { CuratedVoice } from './voiceLibrary';
import { parseVoiceDescription, ParsedVoiceAttributes } from './parseVoiceDescription';

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
  const attributes = parseVoiceDescription(description);
  const descriptionLower = description.toLowerCase();
  
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
  const preFilteredVoices = curatedVoices.filter(voice => {
    // Age filter: if user specifies age, voice MUST match exactly (no exceptions)
    if (attributes.ageGroup) {
      if (!voice.ageGroup || voice.ageGroup !== attributes.ageGroup) {
        return false; // Filter out - doesn't match required age
      }
    }

    // Gender filter: if user specifies gender, voice must match (allow neutral voices as fallback)
    if (attributes.gender) {
      if (voice.gender && voice.gender !== 'neutral' && voice.gender !== attributes.gender) {
        return false; // Filter out - doesn't match required gender
      }
      // If voice is neutral, allow it (neutral can work for either gender)
    }

    // Accent filter: STRICT matching for compound accents
    if (attributes.accent && voice.accent) {
      const attrAccent = attributes.accent.toLowerCase().trim();
      const voiceAccent = voice.accent.toLowerCase().trim();

      // For compound accents, ALL parts must match
      if (attrAccent.includes('-') || attrAccent.includes(' ')) {
        const attrWords = attrAccent.split(/[- ]+/).filter(w => w.length > 2);
        const voiceWords = voiceAccent.split(/[- ]+/).filter(w => w.length > 2);
        
        // ALL words from user's accent must be present in voice accent
        const allWordsMatch = attrWords.every(attrWord => 
          voiceWords.some(voiceWord => 
            voiceWord === attrWord || 
            voiceWord.includes(attrWord) || 
            attrWord.includes(voiceWord)
          )
        );
        
        if (!allWordsMatch) {
          return false; // Filter out - doesn't have all required accent components
        }
      } else {
        // Single-word accent - check exact or partial match
        if (voiceAccent !== attrAccent && 
            !voiceAccent.includes(attrAccent) && 
            !attrAccent.includes(voiceAccent)) {
          return false; // Filter out - no match
        }
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
    
    // Gender mismatch penalty: -150 points (very heavy penalty - gender is critical)
    if (attributes.gender && voice.gender && voice.gender !== 'neutral') {
      if (voice.gender !== attributes.gender) {
        score -= 150; // Heavy penalty for gender mismatch
      }
    }
    
    // Accent mismatch penalty: -100 points (heavy penalty - accent is important)
    if (attributes.accent && voice.accent) {
      const attrAccent = attributes.accent.toLowerCase().trim();
      const voiceAccent = voice.accent.toLowerCase().trim();
      const accentMatches = voiceAccent === attrAccent || 
                           voiceAccent.includes(attrAccent) || 
                           attrAccent.includes(voiceAccent);
      if (!accentMatches) {
        score -= 100; // Penalty for accent mismatch
      }
    } else if (attributes.accent && !voice.accent) {
      score -= 100; // Penalty if accent specified but voice has none
    }

    // 1. Accent matching (100 points for exact, 80 for partial, 50 for regional partial, 0 for mismatch)
    // PRIORITIZE LABELS: Accent from ElevenLabs labels is authoritative (3x weight multiplier applied later)
    if (attributes.accent && voice.accent) {
      const attrAccent = attributes.accent.toLowerCase().trim();
      const voiceAccent = voice.accent.toLowerCase().trim();

      // Exact match
      if (voiceAccent === attrAccent) {
        score += 100;
        matchDetails.accentMatch = true;
      }
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
      // Single-word accent - check if one contains the other
      else {
        if (voiceAccent.includes(attrAccent) || attrAccent.includes(voiceAccent)) {
          score += 80; // Partial match for single-word accents
          matchDetails.accentMatch = true;
        }
        // Regional accent fuzzy matching (e.g., "north" → "Northern American")
        else {
          const regionalMatches: { [key: string]: string[] } = {
            'north': ['northern', 'north'],
            'northern': ['north', 'northern'],
            'south': ['southern', 'south'],
            'southern': ['south', 'southern'],
            'east': ['eastern', 'east'],
            'eastern': ['east', 'eastern'],
            'west': ['western', 'west'],
            'western': ['west', 'western'],
          };
          
          // Check if it's a regional accent that can match partially
          for (const [key, variations] of Object.entries(regionalMatches)) {
            if (attrAccent === key && variations.some(v => voiceAccent.includes(v))) {
              score += 50; // Regional partial match (e.g., "north" → "Northern American")
              matchDetails.accentMatch = true;
              break;
            }
          }
        }
      }
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

  // 4b. Character matching (50 points for exact match, 30 for partial) - ENHANCED
  // Enhanced: Better matching for "jazz musician" → "musician"
  if (attributes.character) {
    const attrCharacter = attributes.character.toLowerCase();
    // Normalize "jazz musician" to "musician" for matching
    const normalizedCharacter = attrCharacter.includes('jazz') && attrCharacter.includes('musician') 
      ? 'musician' 
      : attrCharacter;
    
    // Check if voice has character in tags or description
    const voiceDescLower = voice.description.toLowerCase();
    const voiceTagsLower = voice.tags.map(t => t.toLowerCase());
    
    // Check for exact match
    if (voiceTagsLower.includes(normalizedCharacter) || voiceDescLower.includes(normalizedCharacter)) {
      if (!matchDetails.keywordMatches.includes(normalizedCharacter)) {
        matchDetails.keywordMatches.push(normalizedCharacter);
        score += 50; // Increased from 40 to 50 for character match boost
      }
    } else {
      // Partial match - check if any tag contains the character keyword
      const hasPartialMatch = voiceTagsLower.some(tag => 
        tag.includes(normalizedCharacter) || normalizedCharacter.includes(tag)
      ) || voiceDescLower.includes(normalizedCharacter);
      
      if (hasPartialMatch && !matchDetails.keywordMatches.includes(normalizedCharacter)) {
        matchDetails.keywordMatches.push(normalizedCharacter);
        score += 30; // Increased from 20 to 30 for partial character match
      }
    }
    
    // Also check for "jazz" separately if looking for musician
    if (normalizedCharacter === 'musician' && descriptionLower.includes('jazz')) {
      if (voiceDescLower.includes('jazz') || voiceTagsLower.some(tag => tag.includes('jazz'))) {
        score += 15; // Increased from 10 to 15 for jazz match bonus
      }
    }
  }

    // 5. Tone matching (30-35 points per matching tone) - ENHANCED for perfect matching
    // Semantic matching for personality/tone synonyms
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

    // Extract personality keywords from description for better matching
    const personalityKeywords: string[] = [];
    descriptionKeywords.forEach(keyword => {
      // Check if keyword matches any tone directly
      voice.tone.forEach(tone => {
        if (tone.toLowerCase().includes(keyword) || keyword.includes(tone.toLowerCase())) {
          if (!matchDetails.toneMatches.includes(tone)) {
            matchDetails.toneMatches.push(tone);
            score += 35; // Increased from 15 to 35 for perfect matching
            personalityKeywords.push(keyword);
          }
        }
      });

      // Check for semantic matches (synonyms)
      for (const [toneKey, synonyms] of Object.entries(toneSynonyms)) {
        if (synonyms.includes(keyword.toLowerCase()) || keyword.toLowerCase() === toneKey) {
          // Check if voice has this tone or any of its synonyms
          const hasMatchingTone = voice.tone.some(tone => {
            const toneLower = tone.toLowerCase();
            return toneLower === toneKey || 
                   synonyms.some(syn => toneLower.includes(syn) || syn.includes(toneLower)) ||
                   toneLower.includes(keyword) || keyword.includes(toneLower);
          });
          
          if (hasMatchingTone && !matchDetails.toneMatches.some(t => t.toLowerCase() === toneKey)) {
            matchDetails.toneMatches.push(toneKey);
            score += 30; // Bonus for semantic match
            personalityKeywords.push(keyword);
          }
        }
      }
    });

    // Also check full description for personality terms not caught by keywords
    const personalityTerms = ['confident', 'friendly', 'professional', 'warm', 'energetic', 'calm', 
                              'sassy', 'witty', 'authoritative', 'polished', 'bold', 'feisty'];
    personalityTerms.forEach(term => {
      if (descriptionLower.includes(term) && !personalityKeywords.includes(term)) {
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
  const bestMatch = sortedMatches[0];
  const confidenceThreshold = 50; // Minimum score for a "good" match
  
  if (bestMatch.score < confidenceThreshold) {
    console.log(`[VOICE MATCHER] Best match score (${bestMatch.score}) below threshold (${confidenceThreshold}). Suggesting voice generation instead.`);
    // Return empty array to trigger fallback to generation
    return [];
  }
  
  // Log confidence levels for debugging
  console.log(`[VOICE MATCHER] Top match score: ${bestMatch.score}, confidence: ${bestMatch.score >= confidenceThreshold ? 'HIGH' : 'LOW'}`);
  
  // Return top matches (up to maxResults)
  return sortedMatches.slice(0, maxResults);
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

