/**
 * Real-time prompt quality scoring for ElevenLabs voice descriptions
 * Provides detailed feedback to help users create better prompts
 */

export interface QualityScore {
  overall: number; // 0-100
  breakdown: {
    length: number; // 0-30 (normalized for display)
    detail: number; // 0-30 (normalized for display)
    specificity: number; // 0-25 (normalized for display)
    safety: number; // 0-20 (normalized for display)
  };
  suggestions: string[];
  level: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface QualityBreakdown {
  length: {
    score: number;
    current: number;
    optimal: string;
    feedback: string;
  };
  detail: {
    score: number;
    found: string[];
    missing: string[];
    feedback: string;
  };
  specificity: {
    score: number;
    feedback: string;
  };
  safety: {
    score: number;
    issues: string[];
    feedback: string;
  };
}

/**
 * Score the quality of a voice description prompt
 */
export function scorePromptQuality(description: string): QualityScore {
  const trimmed = description.trim();
  const length = trimmed.length;
  
  // Score length (0-25 points)
  const lengthScore = scoreLength(length);
  
  // Score detail richness (0-30 points)
  const detailScore = scoreDetail(trimmed);
  
  // Score specificity (0-25 points)
  const specificityScore = scoreSpecificity(trimmed);
  
  // Score safety (0-20 points)
  const safetyScore = scoreSafety(trimmed);
  
  // Total is now 105 points (30+30+25+20) - normalize to 100 for display
  const rawTotal = lengthScore + detailScore + specificityScore + safetyScore;
  const overall = Math.min(100, Math.round((rawTotal / 105) * 100));
  
  // Determine level
  let level: 'poor' | 'fair' | 'good' | 'excellent';
  if (overall < 40) level = 'poor';
  else if (overall < 60) level = 'fair';
  else if (overall < 80) level = 'good';
  else level = 'excellent';
  
  // Generate suggestions
  const suggestions = generateSuggestions({
    length: { score: lengthScore, current: length },
    detail: detailScore,
    specificity: specificityScore,
    safety: safetyScore,
    description: trimmed,
  });
  
  // Normalize breakdown scores to 100-point scale for display
  return {
    overall,
    breakdown: {
      length: Math.round((lengthScore / 30) * 28.6), // Normalize to ~28.6 max
      detail: Math.round((detailScore / 30) * 28.6), // Normalize to ~28.6 max
      specificity: Math.round((specificityScore / 25) * 23.8), // Normalize to ~23.8 max
      safety: Math.round((safetyScore / 20) * 19.0), // Normalize to ~19.0 max
    },
    suggestions,
    level,
  };
}

/**
 * Score length (0-30 points) - Increased from 25 for better UX
 * Optimal range: 50-500 characters gets full points
 * More forgiving scoring that rewards good descriptions
 */
function scoreLength(length: number): number {
  if (length < 20) {
    return 0; // Below minimum
  }
  if (length > 1000) {
    return 0; // Above maximum
  }
  
  // Optimal range: 50-500 characters gets full points
  if (length >= 50 && length <= 500) {
    return 30; // Full points for optimal length
  }
  
  // 20-49: More forgiving - 20 chars = 10 points, 50 chars = 28 points
  if (length < 50) {
    const progress = Math.min(1, (length - 20) / 30); // 0 to 1, capped
    return Math.round(10 + progress * 18); // 10-28 (more forgiving)
  }
  
  // 501-1000: More forgiving - still get good score if close to 500
  if (length > 500) {
    const progress = 1 - ((length - 500) / 500); // 1 to 0
    return Math.round(20 + progress * 10); // 20-30 (more forgiving)
  }
  
  return 0;
}

/**
 * Score detail richness (0-30 points)
 * Checks for presence of key elements: accent, gender, tone, style, character
 */
function scoreDetail(description: string): number {
  const lower = description.toLowerCase();
  let score = 0;
  const found: string[] = [];
  
  // Check for accent (6 points)
  const accentPatterns = [
    /\b(scottish|irish|british|english|australian|american|canadian|indian|chinese|japanese|spanish|french|german|italian|russian|arabic|african|caribbean|southern|northern|eastern|western|new york|boston|texan|californian|welsh|dutch|swedish|norwegian|danish|polish|greek|turkish|portuguese|brazilian|mexican|jamaican|nigerian|south african|korean|vietnamese|thai|filipino)\b/i,
  ];
  if (accentPatterns.some(pattern => pattern.test(description))) {
    score += 6;
    found.push('accent');
  }
  
  // Check for gender (6 points)
  if (/\b(female|woman|girl|ladies?|male|man|boy|guy|gentleman|dude)\b/i.test(description)) {
    score += 6;
    found.push('gender');
  }
  
  // Check for tone (6 points) - expanded to catch variations
  const toneWords = /\b(nonchalant|casual|confident|serious|professional|friendly|warm|cold|stern|gentle|harsh|energetic|calm|relaxed|intense|laid-back|enthusiastic|monotone|expressive|dramatic|authoritative|observant|precise|sharp|assertive|kindly|kind|excited|exciting|calming|soothing|upbeat|cheerful|serene|peaceful|aggressive|passive|assertive|subdued|bright|dark|light|heavy|soft|loud|quiet|mellow|vibrant)\b/i;
  // Also check for tone phrases
  const tonePhrases = /\b(speaking\s+(?:with|in|using)\s+(?:excitement|calm|energy|enthusiasm|passion|warmth|coolness|serenity))|(very\s+(?:excited|calm|energetic|relaxed|intense|gentle|harsh|warm|cold|friendly|professional))|(sounds?\s+(?:excited|calm|energetic|relaxed|intense|gentle|harsh|warm|cold|friendly|professional))\b/i;
  if (toneWords.test(description) || tonePhrases.test(description)) {
    score += 6;
    found.push('tone');
  }
  
  // Check for style (6 points) - expanded to catch variations and phrases
  const styleWords = /\b(slang|urban|street|formal|informal|conversational|rhythmic|smooth|rough|clear|mumbled|articulate|fast|slow|measured|quick|deliberate|authentic|natural|slangy|up-pitched|up\s*pitched|high-pitched|low-pitched|deep|shallow|nasal|breathy|raspy|gravelly|smooth|rough|precise|vague|eloquent|simple|complex|sophisticated|casual|polished)\b/i;
  // Also check for style phrases
  const stylePhrases = /\b(speaking\s+(?:with|in|using)\s+(?:slang|formality|casualness|rhythm|speed|clarity|articulation))|(speaks?\s+(?:with|in)\s+(?:slang|a\s+(?:formal|informal|casual|professional|conversational)\s+tone?))|(uses?\s+(?:slang|complex|simple|sophisticated)\s+vocabulary)|(vocabulary|vocab|words?)\s+(?:is|are|should\s+be)\s+(?:complex|simple|sophisticated|eloquent|basic)\b/i;
  if (styleWords.test(description) || stylePhrases.test(description)) {
    score += 6;
    found.push('style');
  }
  
  // Check for character/profession (6 points)
  const characterPattern = /\b(bodybuilder|meathead|detective|sherlock|spy|agent|hero|villain|wizard|warrior|knight|pirate|ninja|rapper|singer|artist|musician|narrator|announcer|host|podcaster|teacher|professor|doctor|nurse|lawyer|judge|attorney|soldier|military|veteran|coach|trainer|instructor|teenager|teen)\b/i;
  if (characterPattern.test(description)) {
    score += 6;
    found.push('character');
  }
  
  return score;
}

/**
 * Score specificity (0-25 points)
 * Checks for concrete vs vague descriptions
 */
function scoreSpecificity(description: string): number {
  let score = 0;
  
  // Check for specific age mentions (5 points)
  if (/\b\d+\s*(?:year|yr)[\s-]?old\b/i.test(description)) {
    score += 5;
  }
  
  // Check for specific catchphrases or speech patterns (5 points)
  if (/['"]([^'"]+)['"]/.test(description) || /\b(?:says?|uses?|keeps?)\s+(?:on\s+)?(?:saying|using)\s+/.test(description)) {
    score += 5;
  }
  
  // Check for specific adjectives (not just generic ones) (5 points)
  const specificAdjectives = /\b(scottish|irish|british|gravelly|smooth|rough|deep|high|low|resonant|bright|dark|warm|cold)\b/i;
  if (specificAdjectives.test(description)) {
    score += 5;
  }
  
  // Check for multiple descriptive elements (10 points)
  // Count distinct descriptive words/phrases - more comprehensive
  const descriptiveElements = [
    ...(description.match(/\b(scottish|irish|british|american|australian|canadian|indian|spanish|french|german|chinese|japanese|arabic|african|caribbean|mexican|brazilian)\b/gi) || []),
    ...(description.match(/\b(male|female|man|woman|guy|girl|boy|ladies?|gentleman|dude)\b/gi) || []),
    ...(description.match(/\b(young|old|middle-aged|teen|teenager|youth|elderly|senior)\b/gi) || []),
    ...(description.match(/\b(confident|casual|professional|friendly|warm|excited|calm|energetic|relaxed|intense|gentle|harsh|serious|playful)\b/gi) || []),
    ...(description.match(/\b(slang|urban|formal|informal|conversational|smooth|clear|articulate|complex|simple|sophisticated)\b/gi) || []),
  ];
  
  const uniqueElements = new Set(descriptiveElements.map(e => e.toLowerCase()));
  if (uniqueElements.size >= 4) {
    score += 10;
  } else if (uniqueElements.size >= 3) {
    score += 7;
  } else if (uniqueElements.size >= 2) {
    score += 4;
  } else if (uniqueElements.size >= 1) {
    score += 2;
  }
  
  return Math.min(25, score);
}

/**
 * Score safety (0-20 points)
 * Checks for potentially blocked terms (currently minimal since "young" works)
 */
function scoreSafety(description: string): number {
  // Start with full points
  let score = 20;
  const issues: string[] = [];
  
  // Check for obviously problematic terms (if any exist)
  // Note: "young", "teenager", etc. are now allowed per user confirmation
  const blockedTerms: { pattern: RegExp; term: string }[] = [
    // Add any truly blocked terms here if discovered
  ];
  
  for (const { pattern, term } of blockedTerms) {
    if (pattern.test(description)) {
      score -= 10;
      issues.push(term);
    }
  }
  
  // Ensure minimum score of 0
  return Math.max(0, score);
}

/**
 * Generate actionable suggestions based on scores
 */
function generateSuggestions(context: {
  length: { score: number; current: number };
  detail: number;
  specificity: number;
  safety: number;
  description: string;
}): string[] {
  const suggestions: string[] = [];
  const { length, detail, specificity, safety, description } = context;
  
  // Length suggestions
  if (length.score < 15) {
    if (length.current < 20) {
      suggestions.push(`Add ${20 - length.current} more characters to meet the minimum (20 characters)`);
    } else if (length.current < 50) {
      suggestions.push('Add more details to reach the optimal length (50-500 characters)');
    } else if (length.current > 1000) {
      suggestions.push('Shorten your description to under 1000 characters');
    }
  }
  
  // Detail suggestions
  if (detail < 18) {
    const missing: string[] = [];
    const lower = description.toLowerCase();
    
    if (!/\b(scottish|irish|british|american|australian|canadian|indian|spanish|french|german|etc)\b/i.test(description)) {
      missing.push('accent');
    }
    if (!/\b(female|woman|girl|male|man|boy|guy)\b/i.test(description)) {
      missing.push('gender');
    }
    if (!/\b(confident|casual|professional|friendly|warm|serious|energetic|calm)\b/i.test(description)) {
      missing.push('tone');
    }
    if (!/\b(slang|urban|formal|conversational|smooth|clear|articulate)\b/i.test(description)) {
      missing.push('style');
    }
    
    if (missing.length > 0) {
      suggestions.push(`Add more details: ${missing.slice(0, 2).join(', ')}`);
    }
  }
  
  // Specificity suggestions
  if (specificity < 15) {
    suggestions.push('Be more specific - add concrete details like age, catchphrases, or speech patterns');
  }
  
  // Safety suggestions (if needed)
  if (safety < 15) {
    suggestions.push('Review your description for any terms that might be blocked');
  }
  
  // Positive reinforcement
  if (context.length.score >= 20 && detail >= 24 && specificity >= 20) {
    suggestions.push('Great description! This should generate excellent results.');
  }
  
  return suggestions.slice(0, 3); // Limit to 3 most important suggestions
}

/**
 * Get detailed breakdown for display
 */
export function getQualityBreakdown(description: string): QualityBreakdown {
  const trimmed = description.trim();
  const length = trimmed.length;
  const lower = trimmed.toLowerCase();
  
  // Length breakdown
  const lengthScore = scoreLength(length);
  let lengthOptimal = 'optimal';
  if (length < 50) lengthOptimal = 'too short';
  if (length > 500) lengthOptimal = 'too long';
  
  // Detail breakdown
  const found: string[] = [];
  const missing: string[] = [];
  
  if (/\b(scottish|irish|british|american|australian|canadian|indian|spanish|french|german)\b/i.test(trimmed)) {
    found.push('accent');
  } else {
    missing.push('accent');
  }
  
  if (/\b(female|woman|girl|male|man|boy|guy)\b/i.test(trimmed)) {
    found.push('gender');
  } else {
    missing.push('gender');
  }
  
  if (/\b(confident|casual|professional|friendly|warm|serious|energetic|calm|kindly|kind)\b/i.test(trimmed)) {
    found.push('tone');
  } else {
    missing.push('tone');
  }
  
  if (/\b(slang|urban|formal|conversational|smooth|clear|articulate)\b/i.test(trimmed)) {
    found.push('style');
  } else {
    missing.push('style');
  }
  
  const detailScore = scoreDetail(trimmed);
  
  // Specificity breakdown
  const specificityScore = scoreSpecificity(trimmed);
  
  // Safety breakdown
  const safetyScore = scoreSafety(trimmed);
  
  // Normalize length score for display
  const normalizedLengthScore = Math.round((lengthScore / 30) * 28.6);
  
  return {
    length: {
      score: normalizedLengthScore,
      current: length,
      optimal: lengthOptimal,
      feedback: length < 20 
        ? `Too short (minimum 20 characters)`
        : length > 1000
        ? `Too long (maximum 1000 characters)`
        : length < 50
        ? `Good, but 50+ characters is optimal`
        : length > 500
        ? `Good, but under 500 characters is optimal`
        : `Perfect length`,
    },
    detail: {
      score: Math.round((detailScore / 30) * 28.6), // Normalize for display
      found,
      missing,
      feedback: missing.length === 0
        ? `All key elements present`
        : `Add: ${missing.join(', ')}`,
    },
    specificity: {
      score: Math.round((specificityScore / 25) * 23.8), // Normalize for display
      feedback: specificityScore >= 20
        ? `Highly specific description`
        : specificityScore >= 15
        ? `Good specificity`
        : `Add more concrete details`,
    },
    safety: {
      score: Math.round((safetyScore / 20) * 19.0), // Normalize for display
      issues: [],
      feedback: safetyScore >= 20
        ? `No safety issues detected`
        : `Review for potentially blocked terms`,
    },
  };
}

