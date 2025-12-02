// Simple in-memory rate limiting
// For production, consider using Redis or a more robust solution

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

/**
 * Rate limit middleware
 * @param identifier - Unique identifier (e.g., IP address)
 * @param options - Rate limit options
 * @returns Object with allowed status and remaining requests
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 15 * 60 * 1000, maxRequests: 5 }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const { windowMs, maxRequests } = options;

  // Get or create entry for this identifier
  let entry = store[identifier];

  // If no entry or window has expired, reset
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    };
    store[identifier] = entry;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  // Clean up old entries periodically (simple cleanup)
  if (Math.random() < 0.01) {
    // 1% chance to clean up on each request
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client IP from NextRequest
 */
export function getClientIP(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback (won't work in serverless, but good for development)
  return 'unknown';
}













