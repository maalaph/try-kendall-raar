import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';
import { getCacheStats } from '@/lib/responseCache';
import { getRateLimitStatus, RATE_LIMITS } from '@/lib/rateLimiter';

/**
 * GET /api/chat/cost-stats
 * Get cost optimization statistics
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

    // Get user record to verify
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Get cache stats
    const cacheStats = getCacheStats();

    // Get rate limit status for user
    const rateLimits = {
      suggestions: getRateLimitStatus(recordId, 'suggestions'),
      memoryExtraction: getRateLimitStatus(recordId, 'memoryExtraction'),
      patternAnalysis: getRateLimitStatus(recordId, 'patternAnalysis'),
      imageAnalysis: getRateLimitStatus(recordId, 'imageAnalysis'),
    };

    return NextResponse.json({
      success: true,
      cache: {
        size: cacheStats.size,
        totalHits: cacheStats.totalHits,
        hitRate: cacheStats.hitRate,
      },
      rateLimits,
      optimization: {
        enabled: true,
        strategies: [
          'Model selection (GPT-4o-mini for simple tasks)',
          'Response caching',
          'Rate limiting',
          'Smart batching',
        ],
      },
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/cost-stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cost stats',
      },
      { status: 500 }
    );
  }
}



