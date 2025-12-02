/**
 * Pattern Extraction from Conversations
 * Automatically extracts user patterns from chat history for learning system
 */

import { upsertUserPattern, getUserPatterns, UserPattern } from './userPatterns';

export interface PatternExtraction {
  patternType: UserPattern['patternType'];
  patternData: UserPattern['patternData'];
  confidence: number;
}

/**
 * Extract patterns from a conversation message
 */
export async function extractPatternsFromMessage(
  recordId: string,
  message: string,
  role: 'user' | 'assistant',
  timestamp: string,
  previousMessages?: Array<{ message: string; role: 'user' | 'assistant'; timestamp: string }>
): Promise<void> {
  if (role !== 'user') return; // Only analyze user messages

  const patterns: PatternExtraction[] = [];

  // Extract recurring call patterns
  const callPattern = extractRecurringCallPattern(message, previousMessages || []);
  if (callPattern) {
    patterns.push(callPattern);
  }

  // Extract time-based preferences
  const timePattern = extractTimeBasedPattern(message);
  if (timePattern) {
    patterns.push(timePattern);
  }

  // Extract contact preferences
  const contactPattern = extractContactPattern(message, previousMessages || []);
  if (contactPattern) {
    patterns.push(contactPattern);
  }

  // Extract preferences
  const preferencePattern = extractPreferencePattern(message);
  if (preferencePattern) {
    patterns.push(preferencePattern);
  }

  // Save patterns (gracefully handle missing tables)
  console.log('[PATTERN EXTRACTION] Extracted', patterns.length, 'pattern(s) from message');
  
  for (const pattern of patterns) {
    try {
      console.log('[PATTERN EXTRACTION] Processing pattern:', {
        type: pattern.patternType,
        confidence: pattern.confidence,
        description: pattern.patternData.description,
      });
      
      // Check if similar pattern exists
      const existingPatterns = await getUserPatterns(recordId, pattern.patternType);
      const similarPattern = existingPatterns.find(
        (p) => JSON.stringify(p.patternData) === JSON.stringify(pattern.patternData)
      );

      if (similarPattern) {
        // Update existing pattern confidence
        console.log('[PATTERN EXTRACTION] Updating existing pattern, increasing confidence from', similarPattern.confidence);
        await upsertUserPattern({
          ...similarPattern,
          confidence: Math.min(1, similarPattern.confidence + 0.1), // Increase confidence
          lastObserved: timestamp,
        });
        console.log('[PATTERN EXTRACTION] Successfully updated pattern');
      } else {
        // Create new pattern
        console.log('[PATTERN EXTRACTION] Creating new pattern');
        await upsertUserPattern({
          recordId,
          patternType: pattern.patternType,
          patternData: pattern.patternData,
          confidence: pattern.confidence,
          lastObserved: timestamp,
        });
        console.log('[PATTERN EXTRACTION] Successfully created new pattern');
      }
    } catch (error) {
      // Gracefully handle missing tables - don't break the flow
      console.error('[PATTERN EXTRACTION] Could not save pattern:', error);
      console.error('[PATTERN EXTRACTION] Error details:', {
        patternType: pattern.patternType,
        recordId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue processing - pattern extraction doesn't break if storage fails
    }
  }
  
  if (patterns.length === 0) {
    console.log('[PATTERN EXTRACTION] No patterns detected in message');
  }
}

/**
 * Extract recurring call pattern
 */
function extractRecurringCallPattern(
  message: string,
  previousMessages: Array<{ message: string; role: string; timestamp: string }>
): PatternExtraction | null {
  const lowerMessage = message.toLowerCase();

  // Look for calls to specific contacts
  const callMatches = lowerMessage.match(/(?:call|phone|dial|contact)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (!callMatches) return null;

  const contactName = callMatches[1].trim();
  
  // Look for day/time mentions
  const dayMatch = lowerMessage.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend)/i);
  const timeMatch = lowerMessage.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) || 
                    lowerMessage.match(/(\d{1,2})\s*(am|pm)/i);

  // Check if this is mentioned multiple times in recent messages
  const recentCallCount = previousMessages.filter(
    (m) => m.role === 'user' && m.message.toLowerCase().includes(contactName.toLowerCase())
  ).length;

  if (recentCallCount >= 2) {
    const dayOfWeek = dayMatch ? getDayOfWeek(dayMatch[1]) : undefined;
    const timeOfDay = timeMatch ? extractTime(timeMatch) : undefined;

    return {
      patternType: 'recurring_call',
      patternData: {
        description: `Calls ${contactName}${dayOfWeek !== undefined ? ` on ${getDayName(dayOfWeek)}` : ''}${timeOfDay ? ` at ${timeOfDay}` : ''}`,
        frequency: dayOfWeek !== undefined ? 'weekly' : undefined,
        dayOfWeek,
        timeOfDay,
        contactName,
        metadata: { observedCount: recentCallCount },
      },
      confidence: Math.min(0.8, 0.3 + recentCallCount * 0.1),
    };
  }

  return null;
}

/**
 * Extract time-based pattern
 */
function extractTimeBasedPattern(message: string): PatternExtraction | null {
  const lowerMessage = message.toLowerCase();

  // Look for preferences about time
  const morningPref = /(morning|before noon|early|9am|10am|11am)/i.test(lowerMessage);
  const afternoonPref = /(afternoon|after noon|2pm|3pm|4pm)/i.test(lowerMessage);
  const eveningPref = /(evening|night|after 5|after 6)/i.test(lowerMessage);

  if (morningPref || afternoonPref || eveningPref) {
    return {
      patternType: 'time_based_action',
      patternData: {
        description: `Prefers ${morningPref ? 'morning' : afternoonPref ? 'afternoon' : 'evening'} activities`,
        timeOfDay: morningPref ? '09:00' : afternoonPref ? '14:00' : '18:00',
      },
      confidence: 0.6,
    };
  }

  return null;
}

/**
 * Extract contact pattern
 */
function extractContactPattern(
  message: string,
  previousMessages: Array<{ message: string; role: string; timestamp: string }>
): PatternExtraction | null {
  const lowerMessage = message.toLowerCase();

  // Look for contact mentions with context
  const contactMatches = lowerMessage.match(/(?:call|message|contact|reach out to|talk to)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (!contactMatches) return null;

  const contactName = contactMatches[1].trim();
  
  // Check frequency
  const mentionCount = previousMessages.filter(
    (m) => m.message.toLowerCase().includes(contactName.toLowerCase())
  ).length;

  if (mentionCount >= 3) {
    return {
      patternType: 'preferred_contact',
      patternData: {
        description: `Frequently contacts ${contactName}`,
        contactName,
        metadata: { mentionCount },
      },
      confidence: Math.min(0.9, 0.5 + mentionCount * 0.1),
    };
  }

  return null;
}

/**
 * Extract preference pattern
 */
function extractPreferencePattern(message: string): PatternExtraction | null {
  const lowerMessage = message.toLowerCase();

  // Look for preference statements
  const preferencePatterns = [
    /(?:i|i'd|i would|i prefer|i like).*?(always|never|prefer|like|don't like)/i,
    /(?:remember|note|important).*?(always|never|prefer)/i,
  ];

  for (const pattern of preferencePatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        patternType: 'preference',
        patternData: {
          description: message.substring(0, 100), // First 100 chars
          metadata: { extracted: true },
        },
        confidence: 0.7,
      };
    }
  }

  return null;
}

/**
 * Helper: Get day of week number
 */
function getDayOfWeek(dayName: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[dayName.toLowerCase()] ?? -1;
}

/**
 * Helper: Get day name from number
 */
function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || '';
}

/**
 * Helper: Extract time from match
 */
function extractTime(match: RegExpMatchArray): string {
  if (match[3]) {
    // Has AM/PM
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase();
    
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    // 24-hour format
    const hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
}

