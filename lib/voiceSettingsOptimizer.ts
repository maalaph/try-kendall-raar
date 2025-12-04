/**
 * Intelligent Voice Settings Optimizer
 * Automatically adjusts stability and similarity_boost based on description characteristics
 */

import { ExtractedElements } from './enhanceVoiceDescription';

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
}

/**
 * Get optimal voice settings based on description characteristics
 * 
 * Rules:
 * - More expressive voices (pirate, sarcastic, energetic) → lower stability (0.3-0.5)
 * - Professional voices → higher stability (0.6-0.8)
 * - Casual/laid-back → medium stability (0.5-0.7)
 * - Character voices → lower stability for more variation
 * - Natural voices → higher similarity_boost (0.7-0.9)
 * - Character voices → medium similarity_boost (0.5-0.7)
 */
export function getOptimalVoiceSettings(
  description: string,
  elements: ExtractedElements
): VoiceSettings {
  const lowerDesc = description.toLowerCase();
  
  // Default settings (balanced)
  let stability = 0.6;
  let similarity_boost = 0.75;
  
  // Check for expressive/character voices
  const isExpressive = 
    lowerDesc.includes('pirate') ||
    lowerDesc.includes('sarcastic') ||
    lowerDesc.includes('energetic') ||
    lowerDesc.includes('excited') ||
    lowerDesc.includes('dramatic') ||
    lowerDesc.includes('character') ||
    elements.character === 'pirate' ||
    elements.character === 'detective' ||
    elements.tone === 'energetic' ||
    elements.tone === 'sarcastic' ||
    elements.tone === 'sassy';
  
  // Check for professional voices
  const isProfessional =
    lowerDesc.includes('professional') ||
    lowerDesc.includes('business') ||
    lowerDesc.includes('corporate') ||
    lowerDesc.includes('formal') ||
    elements.tone === 'professional' ||
    elements.style === 'formal';
  
  // Check for casual voices
  const isCasual =
    lowerDesc.includes('casual') ||
    lowerDesc.includes('laid-back') ||
    lowerDesc.includes('relaxed') ||
    lowerDesc.includes('nonchalant') ||
    elements.tone === 'casual' ||
    elements.tone === 'calm';
  
  // Check for natural/authentic voices
  const isNatural =
    lowerDesc.includes('natural') ||
    lowerDesc.includes('authentic') ||
    lowerDesc.includes('real') ||
    !isExpressive && !isProfessional;
  
  // Adjust stability based on voice type
  if (isExpressive) {
    // Expressive voices need more variation
    stability = 0.35; // Lower for more variation
    similarity_boost = 0.65; // Medium for character voices
  } else if (isProfessional) {
    // Professional voices need consistency
    stability = 0.75; // Higher for consistency
    similarity_boost = 0.85; // Higher for naturalness
  } else if (isCasual) {
    // Casual voices are balanced
    stability = 0.55;
    similarity_boost = 0.75;
  } else if (isNatural) {
    // Natural voices prioritize authenticity
    stability = 0.65;
    similarity_boost = 0.8; // Higher for naturalness
  }
  
  // Fine-tune based on specific characteristics
  if (elements.energy === 'high' || elements.energy === 'intense') {
    stability = Math.max(0.3, stability - 0.1); // Lower for high energy
  } else if (elements.energy === 'low' || elements.energy === 'relaxed') {
    stability = Math.min(0.8, stability + 0.1); // Higher for low energy
  }
  
  // Ensure values are within valid range (0-1)
  stability = Math.max(0.1, Math.min(1.0, stability));
  similarity_boost = Math.max(0.1, Math.min(1.0, similarity_boost));
  
  return {
    stability: Math.round(stability * 100) / 100, // Round to 2 decimal places
    similarity_boost: Math.round(similarity_boost * 100) / 100,
  };
}













