/**
 * Response Caching for Cost Optimization
 * Caches common responses and pattern analysis results
 */

interface CacheEntry {
  key: string;
  value: any;
  expiresAt: number;
  hits: number;
}

// In-memory cache (would use Redis in production)
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached value
 */
export function getCache(key: string): any | null {
  const entry = cache.get(key);
  
  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  // Increment hit count
  entry.hits++;
  return entry.value;
}

/**
 * Set cache value
 */
export function setCache(key: string, value: any, ttl: number = DEFAULT_TTL): void {
  // Evict oldest if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = Array.from(cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]?.[0];
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, {
    key,
    value,
    expiresAt: Date.now() + ttl,
    hits: 0,
  });
}

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(...parts: (string | number | undefined)[]): string {
  return parts
    .filter(p => p !== undefined && p !== null)
    .map(p => String(p).toLowerCase().trim())
    .join(':');
}

/**
 * Clear expired entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  totalHits: number;
  hitRate: number;
} {
  let totalHits = 0;
  for (const entry of cache.values()) {
    totalHits += entry.hits;
  }

  return {
    size: cache.size,
    totalHits,
    hitRate: totalHits / (cache.size || 1),
  };
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredCache, 5 * 60 * 1000);
}




