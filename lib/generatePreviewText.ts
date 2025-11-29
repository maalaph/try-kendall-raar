interface PreviewConfig {
  kendallName: string;
  selectedTraits: string[];
  useCaseChoice: string;
  // Removed userContextAndRules - focusing purely on personality showcase
}

/**
 * Generates personality-driven conversation previews that showcase traits.
 * The preview demonstrates how the voice will sound with the selected personality.
 */
export function generatePreviewText(config: PreviewConfig): string {
  const { kendallName, selectedTraits } = config;
  const assistantName = kendallName || 'Kendall';

  // Determine personality traits
  const traits = selectedTraits || [];
  const isFriendly = traits.includes('Friendly');
  const isProfessional = traits.includes('Professional');
  const isConfident = traits.includes('Confident');
  const isWitty = traits.includes('Witty');
  const isRude = traits.includes('Rude');
  const isSarcastic = traits.includes('Sarcastic');
  const isArrogant = traits.includes('Arrogant');
  const isBlunt = traits.includes('Blunt');
  const isSassy = traits.includes('Sassy');

  // If no traits selected, use neutral/default
  if (traits.length === 0) {
    return `Hello, this is ${assistantName}. How can I help you today?`;
  }

  // Priority order: more distinctive/prominent traits first
  // Create realistic conversation snippets that showcase each personality
  
  if (isRude) {
    return `Yeah, what? This is ${assistantName}. Make it quick, I don't got all day for this.`;
  }
  
  if (isSarcastic) {
    return `Oh fantastic, another call. This is ${assistantName}. How can I possibly help you today?`;
  }
  
  if (isArrogant) {
    return `This is ${assistantName}. I'm assuming you need something important, because my time is obviously valuable.`;
  }
  
  if (isBlunt) {
    return `Hey, ${assistantName} here. What do you need? Let's cut to the chase.`;
  }
  
  if (isSassy) {
    return `Well, well, well. Look who decided to call. This is ${assistantName}. What's going on, then?`;
  }
  
  if (isWitty) {
    return `Hey there! This is ${assistantName}. Hope you're having a better day than my last caller. What can I do for you?`;
  }
  
  if (isConfident && isProfessional) {
    return `Hello, this is ${assistantName}. I'm ready to handle whatever you need. How can I assist you today?`;
  }
  
  if (isProfessional) {
    return `Hello, this is ${assistantName}. Thank you for calling. How may I assist you today?`;
  }
  
  if (isFriendly) {
    return `Hi! This is ${assistantName}. So glad you reached out! How can I help you today?`;
  }
  
  // Default friendly professional
  return `Hello, this is ${assistantName}. How can I help you today?`;
}

/**
 * Get voice settings based on personality traits for ElevenLabs API.
 * Adjusts stability and similarity_boost to enhance personality expression.
 */
export function getVoiceSettingsFromPersonality(traits: string[]): {
  stability: number;
  similarity_boost: number;
} {
  // Default settings
  let stability = 0.5;
  let similarity_boost = 0.75;

  // Adjust based on personality traits to enhance expression
  if (traits.includes('Professional') || traits.includes('Confident')) {
    stability = 0.7; // More stable, consistent, authoritative delivery
    similarity_boost = 0.8;
  }
  
  if (traits.includes('Witty') || traits.includes('Sassy')) {
    stability = 0.4; // More variation, expressive, playful intonation
    similarity_boost = 0.7;
  }
  
  if (traits.includes('Blunt') || traits.includes('Rude')) {
    stability = 0.6; // Direct, clear, no-nonsense
    similarity_boost = 0.75;
  }
  
  if (traits.includes('Sarcastic')) {
    stability = 0.35; // More expressive, varied intonation for sarcasm
    similarity_boost = 0.65;
  }

  return { stability, similarity_boost };
}

