import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, markThreadsAsDeleted } from '@/lib/database';

const CHAT_MESSAGES_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * DELETE /api/chat/threads/bulk-delete
 * Delete multiple chat threads by deleting all messages with those threadIds
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadIds, recordId } = body;

    if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'threadIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Verify user record exists
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    // Check if Chat Messages table is configured
    if (!CHAT_MESSAGES_API_URL) {
      return NextResponse.json(
        { success: false, error: 'Chat Messages table not configured' },
        { status: 500 }
      );
    }

    let totalDeleted = 0;
    const deletedThreads: string[] = [];
    const failedThreads: Array<{ threadId: string; error: string }> = [];

    // Process each thread
    for (const threadId of threadIds) {
      try {
        // Fetch all messages for this thread
        let allRecords: any[] = [];
        let offset: string | undefined;
        
        do {
          const filterFormula = `{threadId} = "${threadId}"`;
          let url = `${CHAT_MESSAGES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=100`;
          
          if (offset) {
            url += `&offset=${offset}`;
          }
          
          const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(),
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch messages for thread ${threadId}`);
          }

          const result = await response.json();
          const records = result.records || [];
          allRecords = allRecords.concat(records);
          offset = result.offset;
        } while (offset);

        // Verify all messages belong to this user
        const allBelongToUser = allRecords.every((record: any) => {
          const recordIdField = record.fields?.recordId;
          if (Array.isArray(recordIdField)) {
            return recordIdField.includes(recordId);
          } else {
            return recordIdField === recordId;
          }
        });

        if (!allBelongToUser) {
          failedThreads.push({ threadId, error: 'Thread does not belong to this user' });
          continue;
        }

        // Delete all messages for this thread
        if (allRecords.length > 0) {
          const batchSize = 10;
          const messageIds = allRecords.map(record => record.id);

          for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            const queryParams = batch.map(id => `records[]=${encodeURIComponent(id)}`).join('&');
            const deleteResponse = await fetch(`${CHAT_MESSAGES_API_URL}?${queryParams}`, {
              method: 'DELETE',
              headers: getHeaders(),
            });

            if (!deleteResponse.ok) {
              throw new Error(`Failed to delete messages batch for thread ${threadId}`);
            }
          }

          totalDeleted += allRecords.length;
        }
        // Mark thread for deletion (even if it has no messages)
        deletedThreads.push(threadId);
      } catch (error) {
        console.error(`[API ERROR] Failed to delete thread ${threadId}:`, error);
        failedThreads.push({
          threadId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Mark threads as deleted in Supabase (soft delete - keeps data for AI learning)
    // This is for UI organization only, the data remains for pattern recognition
    if (deletedThreads.length > 0) {
      try {
        await markThreadsAsDeleted(recordId, deletedThreads);
      } catch (threadDeleteError) {
        console.error('[API ERROR] Failed to mark threads as deleted in Supabase:', threadDeleteError);
        // Continue even if marking fails - messages are already deleted from Airtable
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedThreads.length} thread(s), ${totalDeleted} message(s)`,
      deletedThreads,
      failedThreads,
      totalDeleted,
    });
  } catch (error) {
    console.error('[API ERROR] DELETE /api/chat/threads/bulk-delete failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete threads',
      },
      { status: 500 }
    );
  }
}

