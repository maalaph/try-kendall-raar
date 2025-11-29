/**
 * Universal voice description enhancer - works for ANY description
 * Extracts elements dynamically and structures them without hardcoding scenarios
 */

export interface ExtractedElements {
  accent?: string;
  gender?: string;
  profession?: string;
  character?: string;
  tone?: string;
  style?: string;
  age?: string;
  energy?: string;
  timbre?: string[]; // Voice timbre characteristics (deep, raspy, smoker's, etc.)
  catchphrases?: string[];
  speechPatterns?: string[];
  other: string[];
}

export function enhanceVoiceDescription(description: string): {
  enhanced: string;
  extractedElements: ExtractedElements;
} {
  const original = description.trim();
  const elements = extractAllElements(original);
  const enhanced = buildStructuredDescription(original, elements);
  
  return {
    enhanced: enhanced.trim(),
    extractedElements: elements,
  };
}

function extractAllElements(description: string): ExtractedElements {
  const lowerDesc = description.toLowerCase();
  const elements: ExtractedElements = { other: [] };

  // Extract age (e.g., "30-year-old", "25 years old", "young teenager")
  // Enhanced: Better mapping for specific ages like "65-year-old" → "elderly"
  const agePattern = /\b(\d+)[\s-]?(?:year|yr)[\s-]?old\b/i;
  const ageMatch = description.match(agePattern);
  if (ageMatch) {
    const ageNum = parseInt(ageMatch[1]);
    // Map specific ages to age groups
    if (ageNum >= 60) {
      elements.age = 'elderly'; // 65-year-old → elderly
    } else if (ageNum >= 40) {
      elements.age = 'middle-aged';
    } else if (ageNum >= 18) {
      elements.age = 'young adult';
    } else {
      elements.age = 'young';
    }
    // Store original age for reference
    elements.other.push(`${ageNum}-year-old`);
  } else {
    // Check for age phrases - prioritize more specific ones
    if (/\b(young\s+(?:teen|teenager|person|adult|individual|man|woman|boy|girl|kid|child))\b/i.test(description)) {
      // Extract the full phrase like "young teenager"
      const youngPhraseMatch = description.match(/\b(young\s+(?:teen|teenager|person|adult|individual|man|woman|boy|girl|kid|child))\b/i);
      if (youngPhraseMatch) {
        elements.age = youngPhraseMatch[1].toLowerCase();
      } else {
        elements.age = 'young';
      }
    } else if (/\b(teen|teenager|youth|youthful)\b/i.test(description)) {
      elements.age = 'young';
    } else if (/\b(old|elderly|senior|aged)\b/i.test(description)) {
      elements.age = 'older';
    } else if (/\b(middle-aged|middle age)\b/i.test(description)) {
      elements.age = 'middle-aged';
    } else if (/\b(young)\b/i.test(description)) {
      // Generic "young" as fallback
      elements.age = 'young';
    }
  }

  // Extract accent (geographic terms)
  // Enhanced: Better handling for "African" → "African-American"
  const accentPattern = /\b(scottish|irish|british|english|australian|american|canadian|indian|chinese|japanese|spanish|french|german|italian|russian|arabic|african|caribbean|southern|northern|eastern|western|new york|boston|texan|californian|welsh|dutch|swedish|norwegian|danish|polish|greek|turkish|portuguese|brazilian|mexican|jamaican|nigerian|south african|korean|vietnamese|thai|filipino)\b/i;
  const accentMatch = description.match(accentPattern);
  if (accentMatch) {
    let accent = accentMatch[0].toLowerCase();
    // Normalize "African" to "African-American" if in American context
    if (accent === 'african' && (lowerDesc.includes('american') || lowerDesc.includes('us') || lowerDesc.includes('usa'))) {
      accent = 'african-american';
    }
    // Normalize "Indian" to "Indian-American" if in American context
    if (accent === 'indian' && (lowerDesc.includes('american') || lowerDesc.includes('us') || lowerDesc.includes('usa'))) {
      accent = 'indian-american';
    }
    // Normalize "Mexican" to "Mexican-American" if in American context
    if (accent === 'mexican' && (lowerDesc.includes('american') || lowerDesc.includes('us') || lowerDesc.includes('usa'))) {
      accent = 'mexican-american';
    }
    // Normalize "Asian" to "Asian-American" if in American context
    if (accent === 'asian' && (lowerDesc.includes('american') || lowerDesc.includes('us') || lowerDesc.includes('usa'))) {
      accent = 'asian-american';
    }
    elements.accent = accent;
  }

  // Extract gender
  if (/\b(female|woman|girl|ladies?)\b/i.test(description)) {
    elements.gender = 'female';
  } else if (/\b(male|man|boy|guy|gentleman|dude)\b/i.test(description)) {
    elements.gender = 'male';
  }

  // Extract profession/character - look for "like a X" or "sounding like X" or "X voice"
  const professionPatterns = [
    /\b(sounding like|like a|as a|voice of|character of|speaking like)\s+([a-z]+(?:\s+[a-z]+)?)/i,
    /\b([a-z]+(?:\s+[a-z]+)?)\s+(voice|speaker|narrator|character|person)\b/i,
  ];
  
  for (const pattern of professionPatterns) {
    const match = description.match(pattern);
    if (match) {
      const profession = match[match.length - 1].toLowerCase();
      // Filter out common words that aren't professions
      if (!['the', 'a', 'an', 'this', 'that', 'your', 'my', 'our', 'voice', 'speaker', 'narrator', 'character', 'person'].includes(profession)) {
        elements.profession = profession;
        break;
      }
    }
  }

  // Extract character types (bodybuilder, meathead, detective, etc.)
  // Enhanced: Better extraction for "jazz musician" → "musician"
  const characterPattern = /\b(bodybuilder|meathead|detective|sherlock|spy|agent|hero|villain|wizard|warrior|knight|pirate|ninja|rapper|singer|artist|musician|jazz\s+musician|narrator|announcer|host|podcaster|teacher|professor|doctor|nurse|lawyer|judge|attorney|soldier|military|veteran|coach|trainer|instructor)\b/i;
  const characterMatch = description.match(characterPattern);
  if (characterMatch) {
    let character = characterMatch[0].toLowerCase();
    // Normalize "jazz musician" to "musician"
    if (character.includes('jazz') && character.includes('musician')) {
      character = 'musician';
    }
    elements.character = character;
  }
  
  // Also check for "like a X" patterns for character extraction
  const likePattern = /\b(like\s+a|sounding\s+like\s+a|voice\s+of\s+a)\s+([a-z]+(?:\s+[a-z]+)?)\b/i;
  const likeMatch = description.match(likePattern);
  if (likeMatch && !elements.character) {
    const characterFromLike = likeMatch[2].toLowerCase();
    // Check if it's a valid character type
    if (['musician', 'jazz musician', 'narrator', 'singer', 'artist', 'host', 'podcaster', 'teacher', 'professor', 'detective'].some(c => characterFromLike.includes(c))) {
      if (characterFromLike.includes('jazz') && characterFromLike.includes('musician')) {
        elements.character = 'musician';
      } else if (characterFromLike.includes('musician')) {
        elements.character = 'musician';
      } else {
        elements.character = characterFromLike;
      }
    }
  }

  // Extract tone - expanded to catch more variations
  const toneWords = description.match(/\b(nonchalant|casual|confident|serious|professional|friendly|warm|cold|stern|gentle|harsh|energetic|calm|relaxed|intense|laid-back|enthusiastic|monotone|expressive|dramatic|authoritative|observant|precise|sharp|muscular|aggressive|assertive|excited|exciting|calming|soothing|upbeat|cheerful|serene|peaceful|subdued|bright|dark|light|heavy|soft|loud|quiet|mellow|vibrant)\b/gi);
  if (toneWords && toneWords.length > 0) {
    elements.tone = toneWords[0].toLowerCase();
  } else {
    // Check for tone phrases
    const tonePhraseMatch = description.match(/\b(speaking\s+(?:with|in|using)\s+(?:excitement|calm|energy|enthusiasm|passion|warmth|coolness|serenity))|(very\s+(?:excited|calm|energetic|relaxed|intense|gentle|harsh|warm|cold|friendly|professional))|(sounds?\s+(?:excited|calm|energetic|relaxed|intense|gentle|harsh|warm|cold|friendly|professional))\b/i);
    if (tonePhraseMatch) {
      // Extract the key tone word from the phrase
      const toneKey = tonePhraseMatch[0].match(/\b(excited|calm|energetic|relaxed|intense|gentle|harsh|warm|cold|friendly|professional|excitement|energy|enthusiasm|passion|warmth|serenity)\b/i);
      if (toneKey) {
        elements.tone = toneKey[0].toLowerCase();
      }
    }
  }

  // Extract style - expanded to catch more variations
  // Enhanced: Better extraction for timbre characteristics (deep, raspy, smoker's voice)
  const styleWords = description.match(/\b(slang|urban|street|formal|informal|conversational|rhythmic|smooth|rough|clear|mumbled|articulate|fast|slow|measured|quick|deliberate|authentic|natural|slangy|up-pitched|up\s*pitched|high-pitched|low-pitched|deep|shallow|nasal|breathy|raspy|gravelly|precise|vague|eloquent|simple|complex|sophisticated|casual|polished|smoker|smoker's|hoarse)\b/gi);
  if (styleWords && styleWords.length > 0) {
    // Prioritize timbre words (deep, raspy, smoker's) for voice characteristics
    const timbreWords = styleWords.filter(w => ['deep', 'raspy', 'gravelly', 'rough', 'smoker', "smoker's", 'hoarse', 'low-pitched'].includes(w.toLowerCase()));
    if (timbreWords.length > 0) {
      elements.style = timbreWords[0].toLowerCase();
      // Store timbre in other for reference
      elements.other.push(...timbreWords.map(w => w.toLowerCase()));
    } else {
      elements.style = styleWords[0].toLowerCase();
    }
  } else {
    // Check for style phrases
    const stylePhraseMatch = description.match(/\b(speaking\s+(?:with|in|using)\s+(?:slang|formality|casualness|rhythm|speed|clarity|articulation))|(speaks?\s+(?:with|in)\s+(?:slang|a\s+(?:formal|informal|casual|professional|conversational)\s+tone?))|(uses?\s+(?:slang|complex|simple|sophisticated)\s+vocabulary)|(vocabulary|vocab|words?)\s+(?:is|are|should\s+be)\s+(?:complex|simple|sophisticated|eloquent|basic)|(up\s*pitched|up-pitched|high\s*pitched|low\s*pitched)\b/i);
    if (stylePhraseMatch) {
      // Extract the key style word from the phrase
      const styleKey = stylePhraseMatch[0].match(/\b(slang|formal|informal|casual|professional|conversational|complex|simple|sophisticated|eloquent|up-pitched|up\s*pitched|high-pitched|low-pitched)\b/i);
      if (styleKey) {
        elements.style = styleKey[0].toLowerCase().replace(/\s+/g, '-');
      }
    }
  }

  // Extract catchphrases and speech patterns (e.g., "keeps saying 'bruh'")
  const catchphrasePatterns = [
    /keeps?\s+(?:on\s+)?(?:saying|using)\s+['"]([^'"]+)['"]/gi,
    /always\s+(?:saying|using)\s+['"]([^'"]+)['"]/gi,
    /frequently\s+(?:saying|using)\s+['"]([^'"]+)['"]/gi,
    /uses?\s+the\s+(?:word|phrase)\s+['"]([^'"]+)['"]/gi,
  ];
  
  elements.catchphrases = [];
  for (const pattern of catchphrasePatterns) {
    const matches = [...description.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        elements.catchphrases.push(match[1]);
      }
    }
  }

  // Extract speech patterns
  if (/\b(keeps?\s+(?:on\s+)?saying|always\s+saying|frequently\s+saying)\b/i.test(description)) {
    elements.speechPatterns = elements.speechPatterns || [];
    elements.speechPatterns.push('repetitive phrases');
  }

  // Extract energy
  const energyMatch = description.match(/\b(high|low|moderate|intense|relaxed)\s+energy\b/i);
  if (energyMatch) {
    elements.energy = energyMatch[1].toLowerCase();
  }

  // Extract timbre characteristics (deep, raspy, smoker's voice, etc.)
  // Enhanced: Better extraction for voice timbre
  elements.timbre = [];
  const timbrePatterns = [
    /\b(deep\s+voice|deep\s+raspy|deep\s+smoker|deep)\b/gi,
    /\b(raspy\s+voice|raspy\s+smoker|raspy)\b/gi,
    /\b(smoker'?s?\s+voice|smoker'?s?)\b/gi,
    /\b(gravelly|rough|hoarse|husky)\b/gi,
    /\b(smooth|clear|soft|warm|bright)\b/gi,
  ];
  
  for (const pattern of timbrePatterns) {
    const matches = description.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.toLowerCase().trim();
        if (!elements.timbre?.includes(cleanMatch)) {
          elements.timbre.push(cleanMatch);
        }
      });
    }
  }
  
  // If we found timbre words in style, add them to timbre array
  if (elements.style && ['deep', 'raspy', 'gravelly', 'rough', 'smoker', "smoker's", 'hoarse'].includes(elements.style)) {
    if (!elements.timbre?.includes(elements.style)) {
      elements.timbre.push(elements.style);
    }
  }

  return elements;
}

function buildStructuredDescription(original: string, elements: ExtractedElements): string {
  // PRIORITIZE: Use original description as-is if it's detailed enough
  // Only enhance minimally to ensure ElevenLabs understands it clearly
  
  const originalTrimmed = original.trim();
  const originalLength = originalTrimmed.length;
  const hasKeyDetails = !!(elements.accent || elements.character || elements.profession || 
                           elements.tone || elements.style ||
                           originalTrimmed.match(/\b(accent|sounding|like|voice|character|pirate|detective|italian|british|scottish|old|young)\b/i));
  
  // If original is good (30+ chars, has details), use it directly with minimal enhancement
  if (originalLength >= 30 && hasKeyDetails) {
    // Use original, just ensure accent/characteristics are emphasized
    let enhanced = originalTrimmed;
    
    // Enhanced: Better accent normalization (African → African-American)
    if (elements.accent) {
      const accentLower = elements.accent.toLowerCase();
      // Normalize "african" to "african-american" if not already specified
      if (accentLower === 'african' && !enhanced.toLowerCase().includes('african-american')) {
        enhanced = enhanced.replace(/\bafrican\b/gi, 'African-American');
        elements.accent = 'african-american';
      }
      // Normalize "indian" to "indian-american" if not already specified
      if (accentLower === 'indian' && !enhanced.toLowerCase().includes('indian-american')) {
        enhanced = enhanced.replace(/\bindian\b/gi, 'Indian-American');
        elements.accent = 'indian-american';
      }
    }
    
    // Enhanced: Emphasize timbre characteristics (deep, raspy, smoker's voice)
    if (elements.timbre && elements.timbre.length > 0) {
      const timbreWords = elements.timbre.join(' ');
      if (!enhanced.toLowerCase().includes(timbreWords.toLowerCase())) {
        // Add timbre emphasis if not already present
        enhanced = `${enhanced} with ${timbreWords} voice characteristics`;
      }
    }
    
    // If accent is detected but not explicitly stated, emphasize it
    if (elements.accent && !enhanced.toLowerCase().includes('accent')) {
      const accentLower = elements.accent.toLowerCase();
      if (!enhanced.toLowerCase().includes(accentLower)) {
        // Add accent emphasis naturally
        enhanced = `${elements.accent} accent: ${enhanced}`;
      } else {
        // Accent mentioned but not emphasized - add emphasis
        enhanced = enhanced.replace(
          new RegExp(`\\b${accentLower}\\b`, 'i'),
          `${elements.accent} accent`
        );
      }
    }
    
    // Enhanced: Emphasize deep voice for elderly ages (65-year-old → elderly + deep voice)
    if (elements.age && (elements.age.includes('elderly') || elements.age.includes('older') || elements.other.some(o => o.includes('65') || o.includes('60')))) {
      if (!enhanced.toLowerCase().includes('deep') && !enhanced.toLowerCase().includes('raspy')) {
        enhanced = `${enhanced} with deep voice characteristics`;
      }
    }
    
    // Ensure authenticity note
    if (!enhanced.toLowerCase().includes('authentic') && !enhanced.toLowerCase().includes('should')) {
      enhanced += '. The voice should authentically capture these characteristics.';
    }
    
    return enhanced;
  }
  
  // For shorter descriptions, build structured but keep it natural
  const parts: string[] = [];

  // Build description dynamically based on what we found
  // Preserve age phrases like "young teenager" as-is
  // Start with age + gender + accent (most specific)
  if (elements.age && elements.gender && elements.accent) {
    // Check if age is a phrase (contains space) - preserve it naturally
    if (elements.age.includes(' ')) {
      parts.push(`A ${elements.age} ${elements.accent} ${elements.gender} voice`);
    } else {
      parts.push(`A ${elements.age} ${elements.accent} ${elements.gender} voice`);
    }
  } else if (elements.age && elements.gender) {
    // Preserve age phrases naturally
    parts.push(`A ${elements.age} ${elements.gender} voice`);
  } else if (elements.accent && elements.gender) {
    parts.push(`A ${elements.accent} ${elements.gender} voice`);
  } else if (elements.accent) {
    parts.push(`A ${elements.accent} accent voice`);
  } else if (elements.gender) {
    parts.push(`A ${elements.gender} voice`);
  } else if (elements.age) {
    // Preserve age phrases naturally
    parts.push(`A ${elements.age} voice`);
  } else {
    parts.push('A voice');
  }

  // Add profession/character if found
  if (elements.profession) {
    parts.push(`that sounds like a ${elements.profession}`);
  } else if (elements.character) {
    parts.push(`with a ${elements.character} character`);
  }

  // Add catchphrases if found
  if (elements.catchphrases && elements.catchphrases.length > 0) {
    const catchphraseText = elements.catchphrases.map(cp => `"${cp}"`).join(' and ');
    parts.push(`that frequently uses the catchphrase${elements.catchphrases.length > 1 ? 's' : ''} ${catchphraseText}`);
  }

  // Add tone if found
  if (elements.tone) {
    parts.push(`with a ${elements.tone} tone`);
  }

  // Add style if found
  if (elements.style) {
    parts.push(`using ${elements.style} speaking style`);
  }

  // Add age if not already included
  if (elements.age && !parts[0].includes(elements.age)) {
    parts.push(`with a ${elements.age} age quality`);
  }

  // Add energy if found
  if (elements.energy) {
    parts.push(`and ${elements.energy} energy`);
  }

  // If we extracted structured elements, merge with original
  if (parts.length > 1) {
    let structured = parts.join(', ');
    
    // Always include original to preserve user's exact wording
    structured = `${originalTrimmed}. ${structured}. The voice should authentically capture all these characteristics.`;
    
    return structured;
  }

  // If we couldn't extract much structure, enhance the original minimally
  return `${originalTrimmed}. The voice should sound natural and authentic, capturing all the characteristics described.`;
}

/**
 * Generate sample text using curated templates
 * Uses fixed templates based on voice characteristics (NOT the description)
 * This ensures natural speech that demonstrates the voice, not meta-commentary
 */
export function generateStyleAppropriateText(
  description: string,
  elements: ExtractedElements
): string {
  // Import template function
  const { generateVoiceSampleText } = require('./voiceSampleTemplates');
  
  // Extract voice characteristics (NOT personality)
  const ageGroup = elements.age === 'young' || elements.age?.includes('young') ? 'young' :
                   elements.age === 'older' || elements.age?.includes('old') || elements.age?.includes('elder') ? 'older' :
                   'middle-aged';
  
  const gender = elements.gender === 'male' ? 'male' :
                 elements.gender === 'female' ? 'female' :
                 'neutral';
  
  const accent = elements.accent;
  
  // Extract voice tone (NOT personality tone)
  // Voice tone: energetic (voice energy), calm (voice tone), deep, bright, etc.
  // NOT personality: friendly, professional, rude, etc.
  let voiceTone: string | undefined;
  if (elements.style) {
    // Style can indicate voice tone
    if (['energetic', 'bright', 'clear'].includes(elements.style.toLowerCase())) {
      voiceTone = 'energetic';
    } else if (['calm', 'relaxed', 'smooth'].includes(elements.style.toLowerCase())) {
      voiceTone = 'calm';
    } else if (['deep', 'raspy', 'rough'].includes(elements.style.toLowerCase())) {
      voiceTone = 'deep';
    }
  }
  
  // Detect clear/slow speech requests
  const descLower = description.toLowerCase();
  const clear = descLower.includes('clear') || descLower.includes('slow') || descLower.includes('deliberate');
  const wisdom = descLower.includes('wisdom') || descLower.includes('wise') || descLower.includes('thoughtful');
  
  // Use curated template
  return generateVoiceSampleText({
    ageGroup,
    gender,
    accent,
    tone: voiceTone,
    character: elements.character,
    clear,
    wisdom,
  });
}

