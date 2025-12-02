import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord } from '@/lib/airtable';

const CHAT_MESSAGES_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * DELETE /api/chat/threads/[threadId]
 * Delete a chat thread by deleting all messages with that threadId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: 'threadId is required' },
        { status: 400 }
      );
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId parameter is required' },
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

    // Fetch all messages for this thread directly from Airtable
    // We need raw records to get both record IDs (for deletion) and recordId field (for ownership verification)
    let allRecords: any[] = [];
    let offset: string | undefined;
    
    do {
      // Build filter formula to get all messages for this threadId
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
        const errorData = await response.json().catch(() => ({}));
        console.error('[API ERROR] Failed to fetch messages for thread:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch thread messages',
            details: errorData.error?.message || `Airtable API error: ${response.status} ${response.statusText}`,
          },
          { status: 500 }
        );
      }

      const result = await response.json();
      const records = result.records || [];
      allRecords = allRecords.concat(records);
      
      // Check if there are more records to fetch
      offset = result.offset;
    } while (offset);

    // Verify all messages belong to this user
    // recordId can be either a string or an array (linked record)
    const allBelongToUser = allRecords.every((record: any) => {
      const recordIdField = record.fields?.recordId;
      if (Array.isArray(recordIdField)) {
        // Linked record - check if recordId is in the array
        return recordIdField.includes(recordId);
      } else {
        // String field - direct comparison
        return recordIdField === recordId;
      }
    });

    if (!allBelongToUser) {
      return NextResponse.json(
        { success: false, error: 'Thread does not belong to this user' },
        { status: 403 }
      );
    }

    // Delete all messages for this thread
    if (allRecords.length > 0) {
      // Airtable allows batch deletion of up to 10 records at a time
      const batchSize = 10;
      const messageIds = allRecords.map(record => record.id);

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        // Airtable batch delete format: ?records[]=recXXX&records[]=recYYY
        const queryParams = batch.map(id => `records[]=${encodeURIComponent(id)}`).join('&');
        const deleteResponse = await fetch(`${CHAT_MESSAGES_API_URL}?${queryParams}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          console.error('[API ERROR] Failed to delete messages batch:', errorData);
          // Continue with other batches even if one fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Thread deleted successfully',
      deletedMessageCount: allRecords.length,
    });
  } catch (error) {
    console.error('[API ERROR] DELETE /api/chat/threads/[threadId] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete thread',
      },
      { status: 500 }
    );
  }
}

