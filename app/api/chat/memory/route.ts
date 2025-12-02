import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';
import { upsertUserMemory, getUserMemories, getUserMemoryByKey, deleteUserMemory } from '@/lib/userPatterns';

/**
 * GET /api/chat/memory
 * Get user memories
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const memoryType = searchParams.get('memoryType') as any;
    const importance = searchParams.get('importance') as any;
    const key = searchParams.get('key');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get user record to verify it exists
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // If key is provided, get specific memory
    if (key) {
      try {
        const memory = await getUserMemoryByKey(recordId, key);
        return NextResponse.json({
          success: true,
          memory: memory || null,
        });
      } catch (error) {
        console.warn('[MEMORY API] Could not fetch memory (table may not exist):', error);
        return NextResponse.json({
          success: true,
          memory: null,
        });
      }
    }

    // Otherwise get all memories (with optional filters)
    let memories = [];
    try {
      memories = await getUserMemories(recordId, memoryType, importance);
    } catch (error) {
      console.warn('[MEMORY API] Could not fetch memories (table may not exist):', error);
      // Return empty array - don't break the API
    }

    return NextResponse.json({
      success: true,
      memories,
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/memory failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get memories',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/memory
 * Create or update a user memory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, memoryType, key, value, context, importance, expiresAt } = body;

    if (!recordId || !memoryType || !key || !value) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'recordId, memoryType, key, and value are required' 
        },
        { status: 400 }
      );
    }

    // Get user record to verify it exists
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    let memory;
    try {
      memory = await upsertUserMemory({
        recordId,
        memoryType,
        key,
        value,
        context,
        importance,
        expiresAt,
      });
    } catch (error) {
      console.warn('[MEMORY API] Could not save memory (table may not exist):', error);
      // Return success but without memory - feature degrades gracefully
      return NextResponse.json({
        success: true,
        memory: null,
        warning: 'Memory table not configured. Memory was not saved.',
      });
    }

    return NextResponse.json({
      success: true,
      memory,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/memory failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create/update memory',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/memory
 * Delete a user memory
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get('memoryId');

    if (!memoryId) {
      return NextResponse.json(
        { success: false, error: 'memoryId parameter is required' },
        { status: 400 }
      );
    }

    await deleteUserMemory(memoryId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API ERROR] DELETE /api/chat/memory failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete memory',
      },
      { status: 500 }
    );
  }
}

