import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';
import { getChatMessages } from '@/lib/airtable';
import { getUserPatterns, getUserMemories } from '@/lib/userPatterns';
import { getOrCreateThreadId } from '@/lib/airtable';
import { checkRateLimit } from '@/lib/rateLimiter';
import { getCache, setCache, generateCacheKey } from '@/lib/responseCache';

/**
 * GET /api/chat/suggestions
 * Get smart suggestions for the user based on patterns, time, and context
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get user record
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const fullName = userRecord.fields.fullName || '';
    const nickname = userRecord.fields.nickname || '';
    const kendallName = userRecord.fields.kendallName || 'Kendall';

    // Cost optimization: Rate limit suggestions (but don't block completely)
    const rateLimit = checkRateLimit(recordId, 'suggestions');
    // Note: We still allow suggestions even if rate limited, just log it
    if (!rateLimit.allowed) {
      console.log(`[RATE LIMIT] Suggestions rate limited for user ${recordId}`);
    }

    // Cost optimization: Cache suggestions for 10 minutes
    const cacheKey = generateCacheKey('suggestions', recordId, new Date().getHours().toString());
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        suggestions: cached,
        cached: true,
      });
    }

    // Get patterns and memories (gracefully handle missing tables)
    let patterns = [];
    let memories = [];
    
    try {
      patterns = await getUserPatterns(recordId);
    } catch (error) {
      console.warn('[SUGGESTIONS] Could not fetch patterns (table may not exist):', error);
      // Continue with empty patterns - suggestions will still work
    }
    
    try {
      memories = await getUserMemories(recordId);
    } catch (error) {
      console.warn('[SUGGESTIONS] Could not fetch memories (table may not exist):', error);
      // Continue with empty memories - suggestions will still work
    }

    // Get recent chat messages for context
    let recentContext = '';
    try {
      const threadId = await getOrCreateThreadId(recordId);
      const recentMessages = await getChatMessages({
        threadId,
        limit: 10,
      });
      
      if (recentMessages.messages && recentMessages.messages.length > 0) {
        recentContext = recentMessages.messages
          .slice(-5) // Last 5 messages for context
          .map(m => `${m.role === 'user' ? 'User' : kendallName}: ${m.message}`)
          .join('\n');
      }
    } catch (error) {
      // Continue without recent context if there's an error
      console.warn('[SUGGESTIONS] Could not fetch recent messages:', error);
    }

    // Generate suggestions based on multiple factors
    const suggestions: Array<{
      type: 'time_based' | 'pattern_based' | 'context_based' | 'reminder' | 'proactive';
      priority: 'high' | 'medium' | 'low';
      message: string;
      action?: {
        type: 'call' | 'message' | 'schedule' | 'view';
        data?: Record<string, any>;
      };
    }> = [];

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const displayName = nickname || fullName || 'there';

    // Time-based suggestions
    if (hour >= 6 && hour < 12) {
      suggestions.push({
        type: 'time_based',
        priority: 'medium',
        message: `Good morning ${displayName}! Ready to tackle the day?`,
      });
    } else if (hour >= 17 && hour < 22) {
      suggestions.push({
        type: 'time_based',
        priority: 'low',
        message: `Evening ${displayName}! Anything you want to handle before tomorrow?`,
      });
    }

    // Pattern-based suggestions
    for (const pattern of patterns) {
      if (pattern.patternType === 'recurring_call') {
        const { dayOfWeek: patternDay, timeOfDay, contactName } = pattern.patternData;
        
        // Check if it's the right day
        if (patternDay !== undefined && patternDay === dayOfWeek) {
          if (timeOfDay) {
            const [patternHour, patternMin] = timeOfDay.split(':').map(Number);
            // Suggest within 2 hours of the pattern time
            if (Math.abs(hour - patternHour) <= 2) {
              suggestions.push({
                type: 'pattern_based',
                priority: 'high',
                message: `Want me to call ${contactName || 'them'}? You usually call ${contactName || 'them'} around this time.`,
                action: contactName && pattern.patternData.contactPhone ? {
                  type: 'call',
                  data: {
                    name: contactName,
                    phone: pattern.patternData.contactPhone,
                  },
                } : undefined,
              });
            }
          } else {
            // No specific time, suggest if it's the right day
            suggestions.push({
              type: 'pattern_based',
              priority: 'medium',
              message: `Want me to call ${contactName || 'them'}? You usually call ${contactName || 'them'} on ${getDayName(patternDay)}.`,
              action: contactName && pattern.patternData.contactPhone ? {
                type: 'call',
                data: {
                  name: contactName,
                  phone: pattern.patternData.contactPhone,
                },
              } : undefined,
            });
          }
        }
      }
    }

    // Memory-based suggestions (reminders)
    const reminderMemories = memories.filter(
      m => m.memoryType === 'reminder' && 
      (!m.expiresAt || new Date(m.expiresAt) > now)
    );

    for (const reminder of reminderMemories.slice(0, 3)) {
      suggestions.push({
        type: 'reminder',
        priority: reminder.importance === 'high' ? 'high' : 'medium',
        message: reminder.value,
      });
    }

    // Context-based suggestions (if recent conversation suggests action needed)
    if (recentContext) {
      const lowerContext = recentContext.toLowerCase();
      
      // Check for mentions of scheduling or calling
      if (lowerContext.includes('call') || lowerContext.includes('schedule')) {
        suggestions.push({
          type: 'context_based',
          priority: 'medium',
          message: `Following up on our earlier conversation - need help with anything else?`,
        });
      }

      // Check for file uploads
      if (lowerContext.includes('uploaded file') || lowerContext.includes('file')) {
        suggestions.push({
          type: 'context_based',
          priority: 'low',
          message: `I can help analyze or summarize that file you uploaded. What would you like to know?`,
        });
      }
    }

    // Proactive suggestions based on important memories
    const importantFacts = memories.filter(
      m => m.importance === 'high' && m.memoryType === 'fact'
    );

    if (importantFacts.length > 0 && suggestions.length === 0) {
      // If no other suggestions, offer general help
      suggestions.push({
        type: 'proactive',
        priority: 'low',
        message: `What can I help you with today, ${displayName}?`,
      });
    }

    // Sort suggestions by priority (high first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const topSuggestions = suggestions.slice(0, 3);

    // Cache suggestions for 10 minutes
    setCache(cacheKey, topSuggestions, 10 * 60 * 1000);

    // Return top 3 suggestions
    return NextResponse.json({
      success: true,
      suggestions: topSuggestions,
      rateLimit: {
        remaining: rateLimit.remaining - 1,
        resetAt: rateLimit.resetAt,
      },
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/suggestions failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get suggestions',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get day name from day number
 */
function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || 'that day';
}

