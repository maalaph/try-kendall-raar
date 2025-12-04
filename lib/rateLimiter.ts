/**
 * Rate Limiting for Cost Optimization
 * Limits expensive operations per user
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lastAccess: number;
}

// In-memory rate limit store (would use Redis in production)
const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  suggestions: { max: 10, window: 24 * 60 * 60 * 1000 }, // 10 per day
  memoryExtraction: { max: 3, window: 60 * 60 * 1000 }, // 3 per hour
  patternAnalysis: { max: 5, window: 60 * 60 * 1000 }, // 5 per hour
  imageAnalysis: { max: 20, window: 24 * 60 * 60 * 1000 }, // 20 per day
  complexReasoning: { max: 100, window: 60 * 60 * 1000 }, // 100 per hour
} as const;

/**
 * Check if an action is allowed based on rate limits
 */
export function checkRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();

  let entry = rateLimits.get(key);

  // Initialize or reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + limit.window,
      lastAccess: now,
    };
  }

  // Check if limit exceeded
  const remaining = Math.max(0, limit.max - entry.count);
  const allowed = entry.count < limit.max;

  if (allowed) {
    entry.count++;
    entry.lastAccess = now;
    rateLimits.set(key, entry);
  }

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupRateLimits();
  }

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Get rate limit status for a user
 */
export function getRateLimitStatus(userId: string, action: keyof typeof RATE_LIMITS): {
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
} {
  const limit = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const entry = rateLimits.get(key);

  if (!entry || Date.now() > entry.resetAt) {
    return {
      used: 0,
      limit: limit.max,
      remaining: limit.max,
      resetAt: Date.now() + limit.window,
    };
  }

  return {
    used: entry.count,
    limit: limit.max,
    remaining: Math.max(0, limit.max - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetAt + 24 * 60 * 60 * 1000) { // Keep for 24h after expiry
      rateLimits.delete(key);
    }
  }
}




