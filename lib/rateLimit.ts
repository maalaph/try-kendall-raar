/**
 * Rate Limiting (Upstash)
 * Prevent API abuse and control costs
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

// ============================================
// LEGACY API (for backwards compatibility)
// ============================================

// In-memory rate limit store (fallback when Upstash not configured)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface LegacyRateLimitResult {
  allowed: boolean;
  resetTime: number;
  remaining: number;
}

/**
 * Legacy rate limit function (in-memory, for backwards compatibility)
 */
export function rateLimit(
  identifier: string,
  options: { windowMs: number; maxRequests: number }
): LegacyRateLimitResult {
  const now = Date.now();
  const key = identifier;
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    // Start new window
    rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
    return { allowed: true, resetTime: now + options.windowMs, remaining: options.maxRequests - 1 };
  }

  if (existing.count >= options.maxRequests) {
    return { allowed: false, resetTime: existing.resetTime, remaining: 0 };
  }

  existing.count++;
  return { allowed: true, resetTime: existing.resetTime, remaining: options.maxRequests - existing.count };
}

/**
 * Get client IP from request (legacy)
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

// ============================================
// UPSTASH-BASED RATE LIMITING (new API)
// ============================================

// Rate limiter instances
let chatRateLimiter: Ratelimit | null = null;
let apiRateLimiter: Ratelimit | null = null;

/**
 * Initialize rate limiters
 */
function initRateLimiters(): boolean {
  if (chatRateLimiter && apiRateLimiter) return true;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn('[RATE_LIMIT] Upstash not configured. Rate limiting disabled.');
    return false;
  }
  
  try {
    const redis = new Redis({ url, token });
    
    // Chat rate limiter: 50 messages per hour per user
    chatRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 h'),
      prefix: 'ratelimit:chat',
      analytics: true,
    });
    
    // API rate limiter: 100 requests per minute per IP
    apiRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'ratelimit:api',
      analytics: true,
    });
    
    console.log('[RATE_LIMIT] Rate limiters initialized');
    return true;
  } catch (error) {
    console.error('[RATE_LIMIT] Failed to initialize:', error);
    return false;
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Check chat rate limit for a user
 */
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  if (!initRateLimiters() || !chatRateLimiter) {
    return { success: true, limit: -1, remaining: -1, reset: 0 };
  }
  
  try {
    const result = await chatRateLimiter.limit(userId);
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Chat limit check failed:', error);
    return { success: true, limit: -1, remaining: -1, reset: 0 };
  }
}

/**
 * Check API rate limit for an IP
 */
export async function checkApiRateLimit(ip: string): Promise<RateLimitResult> {
  if (!initRateLimiters() || !apiRateLimiter) {
    return { success: true, limit: -1, remaining: -1, reset: 0 };
  }
  
  try {
    const result = await apiRateLimiter.limit(ip);
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    console.error('[RATE_LIMIT] API limit check failed:', error);
    return { success: true, limit: -1, remaining: -1, reset: 0 };
  }
}

/**
 * Create custom rate limiter
 */
export function createRateLimiter(
  prefix: string,
  limit: number,
  window: string
): {
  check: (identifier: string) => Promise<RateLimitResult>;
} | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  try {
    const redis = new Redis({ url, token });
    
    // Parse window string (e.g., "1 h", "5 m", "1 d")
    const [amount, unit] = window.split(' ');
    const windowMs = parseWindowToMs(parseInt(amount), unit);
    
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `ratelimit:${prefix}`,
      analytics: true,
    });
    
    return {
      check: async (identifier: string) => {
        const result = await limiter.limit(identifier);
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
        };
      },
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Failed to create limiter:', error);
    return null;
  }
}

function parseWindowToMs(amount: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 's':
    case 'second':
    case 'seconds':
      return amount * 1000;
    case 'm':
    case 'minute':
    case 'minutes':
      return amount * 60 * 1000;
    case 'h':
    case 'hour':
    case 'hours':
      return amount * 60 * 60 * 1000;
    case 'd':
    case 'day':
    case 'days':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount * 1000;
  }
}

/**
 * Rate limit headers for API responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
    ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
  };
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: Request) => Promise<Response>,
  options?: {
    type?: 'api' | 'chat';
    getUserId?: (request: Request) => Promise<string | null>;
  }
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const type = options?.type || 'api';
    
    let identifier: string;
    if (type === 'chat' && options?.getUserId) {
      const userId = await options.getUserId(request);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      identifier = userId;
    } else {
      // Use IP for API rate limiting
      identifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
    }
    
    const result = type === 'chat' 
      ? await checkChatRateLimit(identifier)
      : await checkApiRateLimit(identifier);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(result),
          },
        }
      );
    }
    
    // Call the original handler
    const response = await handler(request);
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
