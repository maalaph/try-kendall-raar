/**
 * Sanitizes voice descriptions to avoid ElevenLabs safety blocks
 * while preserving the user's intent
 */
export function sanitizeVoiceDescription(description: string): {
  sanitized: string;
  wasModified: boolean;
  suggestions?: string[];
} {
  const original = description.trim();
  let sanitized = original;
  let wasModified = false;
  const suggestions: string[] = [];

  // Terms that trigger safety blocks and their replacements
  // Note: "young", "teenager", etc. are allowed per user confirmation
  // Only include terms that are actually blocked by ElevenLabs
  const replacements: { [key: string]: string[] } = {
    // Add only truly blocked terms here if discovered
    // Currently empty as "young teenager" and similar terms work
  };

  // Check for problematic terms (case-insensitive)
  const lowerDescription = sanitized.toLowerCase();
  
  for (const [problematic, alternatives] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${problematic}\\b`, 'gi');
    if (regex.test(lowerDescription)) {
      wasModified = true;
      // Use the first alternative
      sanitized = sanitized.replace(regex, alternatives[0]);
      suggestions.push(`Replaced "${problematic}" with "${alternatives[0]}"`);
    }
  }

  return {
    sanitized: sanitized.trim(),
    wasModified,
    suggestions: wasModified ? suggestions : undefined,
  };
}

