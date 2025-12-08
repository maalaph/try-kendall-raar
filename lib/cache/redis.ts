/**
 * Redis Cache (Upstash)
 * Caching utility for frequently accessed data
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (will be null if not configured)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn('[CACHE] Upstash Redis not configured. Caching disabled.');
    return null;
  }
  
  try {
    redis = new Redis({ url, token });
    console.log('[CACHE] Redis client initialized');
    return redis;
  } catch (error) {
    console.error('[CACHE] Failed to initialize Redis:', error);
    return null;
  }
}

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Key prefix */
  prefix?: string;
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string, options?: CacheOptions): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const prefixedKey = options?.prefix ? `${options.prefix}:${key}` : key;
    const value = await client.get<T>(prefixedKey);
    return value;
  } catch (error) {
    console.error('[CACHE] Get error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const prefixedKey = options?.prefix ? `${options.prefix}:${key}` : key;
    const ttl = options?.ttl ?? DEFAULT_TTL;
    
    await client.set(prefixedKey, value, { ex: ttl });
    return true;
  } catch (error) {
    console.error('[CACHE] Set error:', error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string, options?: CacheOptions): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  
  try {
    const prefixedKey = options?.prefix ? `${options.prefix}:${key}` : key;
    await client.del(prefixedKey);
    return true;
  } catch (error) {
    console.error('[CACHE] Delete error:', error);
    return false;
  }
}

/**
 * Get or set with callback
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch and cache
  const value = await fetchFn();
  await cacheSet(key, value, options);
  return value;
}

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  keyFn: (...args: Parameters<T>) => string,
  options?: CacheOptions
) {
  return function (fn: T): T {
    return (async (...args: Parameters<T>) => {
      const key = keyFn(...args);
      return cacheGetOrSet(key, () => fn(...args), options);
    }) as T;
  };
}

// User profile cache helpers
export const userProfileCache = {
  async get(userId: string) {
    return cacheGet(`user:${userId}:profile`, { prefix: 'profiles', ttl: 600 });
  },
  
  async set(userId: string, profile: any) {
    return cacheSet(`user:${userId}:profile`, profile, { prefix: 'profiles', ttl: 600 });
  },
  
  async invalidate(userId: string) {
    return cacheDelete(`user:${userId}:profile`, { prefix: 'profiles' });
  },
};

// User patterns cache helpers
export const userPatternsCache = {
  async get(userId: string) {
    return cacheGet(`user:${userId}:patterns`, { prefix: 'patterns', ttl: 300 });
  },
  
  async set(userId: string, patterns: any) {
    return cacheSet(`user:${userId}:patterns`, patterns, { prefix: 'patterns', ttl: 300 });
  },
  
  async invalidate(userId: string) {
    return cacheDelete(`user:${userId}:patterns`, { prefix: 'patterns' });
  },
};

// Integration status cache helpers
export const integrationStatusCache = {
  async get(userId: string, integration: string) {
    return cacheGet<boolean>(`user:${userId}:integration:${integration}`, { 
      prefix: 'integrations', 
      ttl: 120 
    });
  },
  
  async set(userId: string, integration: string, connected: boolean) {
    return cacheSet(`user:${userId}:integration:${integration}`, connected, { 
      prefix: 'integrations', 
      ttl: 120 
    });
  },
  
  async invalidate(userId: string, integration: string) {
    return cacheDelete(`user:${userId}:integration:${integration}`, { prefix: 'integrations' });
  },
};

/**
 * Clear all cache for a user
 */
export async function clearUserCache(userId: string): Promise<void> {
  await userProfileCache.invalidate(userId);
  await userPatternsCache.invalidate(userId);
  // Note: Integration status would need pattern deletion for all integrations
}

/**
 * Health check for Redis connection
 */
export async function checkCacheHealth(): Promise<{ connected: boolean; latency?: number }> {
  const client = getRedis();
  if (!client) {
    return { connected: false };
  }
  
  try {
    const start = Date.now();
    await client.ping();
    return { connected: true, latency: Date.now() - start };
  } catch (error) {
    return { connected: false };
  }
}



