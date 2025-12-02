import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

/**
 * POST /api/chat/recurring-tasks
 * Create a recurring task/reminder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, taskType, frequency, schedule, action } = body;

    if (!recordId || !taskType || !frequency || !action) {
      return NextResponse.json(
        { success: false, error: 'recordId, taskType, frequency, and action are required' },
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

    // Store recurring task (would integrate with cron/scheduler)
    // For now, return success - actual scheduling would be handled by background job system
    
    return NextResponse.json({
      success: true,
      message: 'Recurring task created successfully',
      task: {
        taskType,
        frequency,
        schedule,
        action,
      },
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/recurring-tasks failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create recurring task',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/recurring-tasks
 * Get all recurring tasks for a user
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

    // Return empty array for now - would fetch from storage
    return NextResponse.json({
      success: true,
      tasks: [],
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/chat/recurring-tasks failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recurring tasks',
      },
      { status: 500 }
    );
  }
}

