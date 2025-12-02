/**
 * Natural language time parsing utility
 * Converts phrases like "in 15 minutes", "tomorrow at 8pm" to ISO 8601 format
 */

/**
 * Parse natural language time expression to ISO 8601 format
 * Supports:
 * - Relative: "in 15 minutes", "in 2 hours", "in 3 days"
 * - Absolute: "tomorrow at 8pm", "next Monday at 9am", "December 25th at 3pm"
 */
export function parseTimeExpression(expression: string, referenceDate: Date = new Date()): string | null {
  if (!expression || typeof expression !== 'string') {
    return null;
  }

  const normalized = expression.toLowerCase().trim();
  
  // Handle "after we hang up", "after we get off the phone", "after call ends", etc.
  const afterCallEndsPatterns = [
    /after\s+we\s+hang\s+up/i,
    /after\s+we\s+get\s+off\s+the\s+phone/i,
    /after\s+call\s+ends/i,
    /after\s+we\s+end\s+this\s+call/i,
    /after\s+we\s+end\s+the\s+call/i,
    /immediately\s+after\s+we\s+hang\s+up/i,
    /immediately\s+after\s+we\s+get\s+off\s+the\s+phone/i,
  ];
  
  for (const pattern of afterCallEndsPatterns) {
    if (pattern.test(normalized)) {
      // Return current time + 90 seconds (1.5 minutes)
      const result = new Date(referenceDate);
      result.setSeconds(result.getSeconds() + 90);
      return result.toISOString();
    }
  }
  
  // Relative time patterns
  const relativePatterns = [
    // "in X minutes"
    { pattern: /in\s+(\d+)\s+minutes?/i, unit: 'minutes' },
    // "in X hours"
    { pattern: /in\s+(\d+)\s+hours?/i, unit: 'hours' },
    // "in X days"
    { pattern: /in\s+(\d+)\s+days?/i, unit: 'days' },
    // "in X weeks"
    { pattern: /in\s+(\d+)\s+weeks?/i, unit: 'weeks' },
  ];

  // Check for relative time
  for (const { pattern, unit } of relativePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const amount = parseInt(match[1], 10);
      const result = new Date(referenceDate);
      
      switch (unit) {
        case 'minutes':
          result.setMinutes(result.getMinutes() + amount);
          break;
        case 'hours':
          result.setHours(result.getHours() + amount);
          break;
        case 'days':
          result.setDate(result.getDate() + amount);
          break;
        case 'weeks':
          result.setDate(result.getDate() + (amount * 7));
          break;
      }
      
      return result.toISOString();
    }
  }

  // Absolute time patterns
  const result = new Date(referenceDate);
  
  // "tomorrow" or "tomorrow at X"
  if (normalized.includes('tomorrow')) {
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    
    // Extract time if provided
    const timeMatch = normalized.match(/(\d{1,2})\s*(am|pm|:(\d{2}))?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const period = timeMatch[2]?.toLowerCase();
      
      if (period === 'pm' && hours !== 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }
      
      result.setHours(hours);
      
      if (timeMatch[3]) {
        const minutes = parseInt(timeMatch[3], 10);
        result.setMinutes(minutes);
      } else {
        result.setMinutes(0);
      }
    }
    
    return result.toISOString();
  }

  // "next Monday", "next Tuesday", etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    const dayPattern = new RegExp(`next\\s+${dayNames[i]}`, 'i');
    if (dayPattern.test(normalized)) {
      const currentDay = result.getDay();
      let daysUntil = (i - currentDay + 7) % 7;
      if (daysUntil === 0) daysUntil = 7; // Next week if it's today
      result.setDate(result.getDate() + daysUntil);
      result.setHours(0, 0, 0, 0);
      
      // Extract time if provided
      const timeMatch = normalized.match(/(\d{1,2})\s*(am|pm|:(\d{2}))?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const period = timeMatch[2]?.toLowerCase();
        
        if (period === 'pm' && hours !== 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        }
        
        result.setHours(hours);
        
        if (timeMatch[3]) {
          const minutes = parseInt(timeMatch[3], 10);
          result.setMinutes(minutes);
        } else {
          result.setMinutes(0);
        }
      }
      
      return result.toISOString();
    }
  }

  // Try to parse as ISO 8601 directly
  try {
    const parsed = new Date(expression);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (e) {
    // Not a valid ISO date
  }

  // If we can't parse it, return null
  return null;
}

/**
 * Check if a time expression represents a future time
 */
export function isFutureTime(expression: string, referenceDate: Date = new Date()): boolean {
  const parsed = parseTimeExpression(expression, referenceDate);
  if (!parsed) return false;
  
  const parsedDate = new Date(parsed);
  return parsedDate > referenceDate;
}

/**
 * Extract time expression from natural language text
 * Looks for patterns like "in 15 minutes", "tomorrow at 8pm", etc.
 */
export function extractTimeExpression(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    /in\s+\d+\s+(minutes?|hours?|days?|weeks?)/i,
    /tomorrow(\s+at\s+\d{1,2}\s*(am|pm|:\d{2})?)?/i,
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\s+at\s+\d{1,2}\s*(am|pm|:\d{2})?)?/i,
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601 format
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

