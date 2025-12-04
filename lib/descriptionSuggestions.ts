/**
 * Smart Description Suggestions
 * Analyzes voice descriptions and suggests improvements in real-time
 */

import { parseVoiceDescription } from './parseVoiceDescription';

export interface DescriptionSuggestion {
  type: 'missing' | 'improvement' | 'example';
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  example?: string;
}

/**
 * Analyze description and generate suggestions
 */
export function analyzeDescription(description: string): {
  suggestions: DescriptionSuggestion[];
  score: number; // 0-100
  missingElements: string[];
} {
  const suggestions: DescriptionSuggestion[] = [];
  const missingElements: string[] = [];
  let score = 100;

  if (!description || description.trim().length === 0) {
    return {
      suggestions: [{
        type: 'missing',
        priority: 'high',
        message: 'Please enter a description',
        suggestion: 'Start by describing the voice you want (e.g., "young female with British accent")',
      }],
      score: 0,
      missingElements: ['description'],
    };
  }

  const trimmed = description.trim();
  const parsed = parseVoiceDescription(trimmed);

  // Check for missing accent
  if (!parsed.accent) {
    missingElements.push('accent');
    score -= 20;
    suggestions.push({
      type: 'missing',
      priority: 'high',
      message: 'Add an accent',
      suggestion: 'Include an accent like "British", "American", "Indian", "Spanish", etc.',
      example: 'young female with British accent',
    });
  }

  // Check for missing gender
  if (!parsed.gender) {
    missingElements.push('gender');
    score -= 20;
    suggestions.push({
      type: 'missing',
      priority: 'high',
      message: 'Specify gender',
      suggestion: 'Add gender like "male", "female", "man", "woman"',
      example: 'young female with British accent',
    });
  }

  // Check for missing age
  if (!parsed.ageGroup) {
    missingElements.push('age');
    score -= 15;
    suggestions.push({
      type: 'missing',
      priority: 'medium',
      message: 'Add age group',
      suggestion: 'Include age like "young", "middle-aged", "older", or specific age',
      example: 'young female with British accent',
    });
  }

  // Check description length
  if (trimmed.length < 30) {
    score -= 15;
    suggestions.push({
      type: 'improvement',
      priority: 'medium',
      message: 'Add more details',
      suggestion: 'Describe more characteristics for better results',
      example: 'young female with British accent, clear and professional tone',
    });
  } else if (trimmed.length > 500) {
    score -= 10;
    suggestions.push({
      type: 'improvement',
      priority: 'low',
      message: 'Description is quite long',
      suggestion: 'Consider focusing on the most important characteristics',
    });
  }

  // Check for vague terms
  const vagueTerms = ['nice', 'good', 'okay', 'fine', 'normal', 'regular'];
  const hasVagueTerms = vagueTerms.some(term => 
    trimmed.toLowerCase().includes(term)
  );

  if (hasVagueTerms) {
    score -= 10;
    suggestions.push({
      type: 'improvement',
      priority: 'medium',
      message: 'Use more specific terms',
      suggestion: 'Replace vague words like "nice" or "good" with specific characteristics',
      example: 'Instead of "nice voice", try "warm and friendly voice"',
    });
  }

  // Provide examples if description is very basic
  if (trimmed.length < 50 && missingElements.length >= 2) {
    suggestions.push({
      type: 'example',
      priority: 'high',
      message: 'Example descriptions',
      suggestion: 'Try: "young female with British accent" or "middle-aged male with American accent, professional tone"',
    });
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    score,
    missingElements,
  };
}

/**
 * Get quick suggestions for improving a description
 */
export function getQuickSuggestions(description: string): string[] {
  const { suggestions } = analyzeDescription(description);
  return suggestions
    .filter(s => s.priority === 'high')
    .slice(0, 3)
    .map(s => s.suggestion);
}

/**
 * Check if description is ready for generation
 */
export function isDescriptionReady(description: string): {
  ready: boolean;
  reasons: string[];
} {
  const { missingElements, score } = analyzeDescription(description);
  const reasons: string[] = [];

  if (description.trim().length < 20) {
    reasons.push('Description must be at least 20 characters');
    return { ready: false, reasons };
  }

  if (missingElements.includes('accent')) {
    reasons.push('Add an accent for better results');
  }
  if (missingElements.includes('gender')) {
    reasons.push('Specify gender for better results');
  }

  const ready = score >= 50 && description.trim().length >= 20;

  return { ready, reasons };
}













