/**
 * Rate Limiter for Integrations
 * In-memory rate limiting with sliding window
 */

import { RateLimitOptions, DEFAULT_RATE_LIMIT } from './types';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitState {
  minute: RateLimitWindow;
  hour: RateLimitWindow;
  day: RateLimitWindow;
}

/**
 * In-memory rate limiter for integrations
 * For production, consider using Redis (Upstash) instead
 */
export class IntegrationRateLimiter {
  private integrationId: string;
  private options: RateLimitOptions;
  private state: Map<string, RateLimitState> = new Map();
  
  constructor(integrationId: string, options: Partial<RateLimitOptions> = {}) {
    this.integrationId = integrationId;
    this.options = { ...DEFAULT_RATE_LIMIT, ...options };
  }
  
  /**
   * Get or create rate limit state for a user
   */
  private getState(userId: string): RateLimitState {
    const key = `${this.integrationId}:${userId}`;
    const now = Date.now();
    
    let state = this.state.get(key);
    
    if (!state) {
      state = {
        minute: { count: 0, resetAt: now + 60 * 1000 },
        hour: { count: 0, resetAt: now + 60 * 60 * 1000 },
        day: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
      };
      this.state.set(key, state);
    }
    
    // Reset windows if expired
    if (now >= state.minute.resetAt) {
      state.minute = { count: 0, resetAt: now + 60 * 1000 };
    }
    if (now >= state.hour.resetAt) {
      state.hour = { count: 0, resetAt: now + 60 * 60 * 1000 };
    }
    if (now >= state.day.resetAt) {
      state.day = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    }
    
    return state;
  }
  
  /**
   * Check if request is allowed
   */
  check(userId: string): {
    allowed: boolean;
    remaining: {
      minute: number;
      hour: number;
      day: number;
    };
    resetIn: {
      minute: number;
      hour: number;
      day: number;
    };
  } {
    const state = this.getState(userId);
    const now = Date.now();
    
    const minuteLimit = this.options.requestsPerMinute;
    const hourLimit = this.options.requestsPerHour || minuteLimit * 60;
    const dayLimit = this.options.requestsPerDay || hourLimit * 24;
    
    const allowed = 
      state.minute.count < minuteLimit &&
      state.hour.count < hourLimit &&
      state.day.count < dayLimit;
    
    return {
      allowed,
      remaining: {
        minute: Math.max(0, minuteLimit - state.minute.count),
        hour: Math.max(0, hourLimit - state.hour.count),
        day: Math.max(0, dayLimit - state.day.count),
      },
      resetIn: {
        minute: Math.max(0, state.minute.resetAt - now),
        hour: Math.max(0, state.hour.resetAt - now),
        day: Math.max(0, state.day.resetAt - now),
      },
    };
  }
  
  /**
   * Record a request
   */
  record(userId: string): void {
    const state = this.getState(userId);
    state.minute.count++;
    state.hour.count++;
    state.day.count++;
  }
  
  /**
   * Check and record in one operation
   */
  acquire(userId: string): {
    success: boolean;
    waitMs?: number;
    remaining?: {
      minute: number;
      hour: number;
      day: number;
    };
  } {
    const check = this.check(userId);
    
    if (check.allowed) {
      this.record(userId);
      return {
        success: true,
        remaining: {
          minute: check.remaining.minute - 1,
          hour: check.remaining.hour - 1,
          day: check.remaining.day - 1,
        },
      };
    }
    
    // Calculate wait time (use shortest window that's exceeded)
    let waitMs = 0;
    if (check.remaining.minute <= 0) {
      waitMs = check.resetIn.minute;
    } else if (check.remaining.hour <= 0) {
      waitMs = check.resetIn.hour;
    } else if (check.remaining.day <= 0) {
      waitMs = check.resetIn.day;
    }
    
    return {
      success: false,
      waitMs,
    };
  }
  
  /**
   * Clear rate limit state for a user
   */
  clear(userId: string): void {
    const key = `${this.integrationId}:${userId}`;
    this.state.delete(key);
  }
  
  /**
   * Clear all rate limit state
   */
  clearAll(): void {
    this.state.clear();
  }
  
  /**
   * Get current usage stats
   */
  getStats(userId: string): {
    minute: { count: number; limit: number };
    hour: { count: number; limit: number };
    day: { count: number; limit: number };
  } {
    const state = this.getState(userId);
    return {
      minute: { 
        count: state.minute.count, 
        limit: this.options.requestsPerMinute 
      },
      hour: { 
        count: state.hour.count, 
        limit: this.options.requestsPerHour || this.options.requestsPerMinute * 60 
      },
      day: { 
        count: state.day.count, 
        limit: this.options.requestsPerDay || (this.options.requestsPerHour || this.options.requestsPerMinute * 60) * 24 
      },
    };
  }
}

// Global rate limiter registry
const rateLimiters: Map<string, IntegrationRateLimiter> = new Map();

/**
 * Get or create a rate limiter for an integration
 */
export function getRateLimiter(
  integrationId: string,
  options?: Partial<RateLimitOptions>
): IntegrationRateLimiter {
  let limiter = rateLimiters.get(integrationId);
  
  if (!limiter) {
    limiter = new IntegrationRateLimiter(integrationId, options);
    rateLimiters.set(integrationId, limiter);
  }
  
  return limiter;
}

/**
 * Rate limit presets for common scenarios
 */
export const RateLimitPresets = {
  /** Low-volume integration (e.g., financial APIs) */
  conservative: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
  } as RateLimitOptions,
  
  /** Standard integration */
  standard: DEFAULT_RATE_LIMIT,
  
  /** High-volume integration (e.g., search, read-only) */
  generous: {
    requestsPerMinute: 120,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
  } as RateLimitOptions,
  
  /** Chat/messaging (balance responsiveness with cost) */
  chat: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 5000,
  } as RateLimitOptions,
};



