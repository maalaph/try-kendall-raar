import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getCallStats, getRecentCallNotes, getUnreadCallNotes, getAllCallNotes, deleteCallNote } from '@/lib/airtable';
import { getContactByPhone } from '@/lib/contacts';
import { formatPhoneNumberToE164 } from '@/lib/vapi';

/**
 * Normalize phone number for comparison (remove all non-digits, handle +1 prefix)
 */
function normalizePhoneForComparison(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  // Remove leading 1 if present (US country code)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.slice(1);
  }
  return cleaned;
}

/**
 * GET /api/stats
 * Get call statistics for a user's agent
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

    // Get user record to find agentId and owner phone
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent not found for this user' },
        { status: 404 }
      );
    }

    // Get owner's phone number for callType determination
    const ownerMobileNumber = userRecord.fields.mobileNumber;
    const normalizedOwnerPhone = ownerMobileNumber ? normalizePhoneForComparison(String(ownerMobileNumber)) : '';

    // Get call statistics
    const stats = await getCallStats(String(agentId));

    // Get unread messages count
    const unreadNotes = await getUnreadCallNotes(String(agentId));

    // Get all call notes and categorize dynamically
    const allCallNotes = await getAllCallNotes(String(agentId), 100);
    
    // Categorize calls: if callerPhone matches owner's number → inbound, else → outbound
    const inboundCalls: any[] = [];
    const outboundCalls: any[] = [];
    
    for (const note of allCallNotes) {
      const normalizedCallerPhone = normalizePhoneForComparison(note.callerPhone || '');
      const isInbound = normalizedOwnerPhone && normalizedCallerPhone && normalizedCallerPhone === normalizedOwnerPhone;
      
      const callData = {
        id: note.id,
        callerPhone: note.callerPhone,
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      };
      
      if (isInbound) {
        inboundCalls.push(callData);
      } else {
        outboundCalls.push(callData);
      }
    }
    
    // Sort by timestamp (most recent first) and limit
    inboundCalls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    outboundCalls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const limitedInbound = inboundCalls.slice(0, 20);
    const limitedOutbound = outboundCalls.slice(0, 20);

    // Get recent activity (last 10 call notes)
    const recentActivity = await getRecentCallNotes(String(agentId), 10);

    // Batch lookup contacts for all phone numbers
    const allPhones = new Set<string>();
    [...limitedInbound, ...limitedOutbound, ...recentActivity].forEach(call => {
      if (call.callerPhone) allPhones.add(call.callerPhone);
    });
    
    const contactMap = new Map<string, string>();
    await Promise.all(
      Array.from(allPhones).map(async (phone) => {
        try {
          const contact = await getContactByPhone(recordId, phone);
          if (contact && contact.name) {
            contactMap.set(phone, contact.name);
          }
        } catch (error) {
          // Silently fail - just won't show name
        }
      })
    );

    // Helper to get display name
    const getDisplayName = (phone: string): string => {
      return contactMap.get(phone) || phone;
    };

    return NextResponse.json({
      success: true,
      totalCalls: stats.totalCalls,
      totalCallMinutes: stats.totalCallMinutes,
      averageCallDuration: stats.averageCallDuration, // in seconds
      unreadMessages: unreadNotes.length,
      recentActivity: recentActivity.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        callerName: getDisplayName(note.callerPhone),
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
      inboundCalls: limitedInbound.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        callerName: 'You', // Inbound calls are from owner
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
      outboundCalls: limitedOutbound.map(note => ({
        id: note.id,
        callerPhone: note.callerPhone,
        callerName: getDisplayName(note.callerPhone),
        note: note.note,
        timestamp: note.timestamp,
        callDuration: note.callDuration,
        read: note.read,
      })),
    });
  } catch (error) {
    console.error('[API ERROR] GET /api/stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stats
 * Delete a call note transcript
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');
    const callNoteId = searchParams.get('callNoteId');

    if (!recordId || !callNoteId) {
      return NextResponse.json(
        { success: false, error: 'recordId and callNoteId parameters are required' },
        { status: 400 }
      );
    }

    // Verify the call note belongs to this user's agent
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent not found for this user' },
        { status: 404 }
      );
    }

    // Delete the call note
    await deleteCallNote(callNoteId);

    return NextResponse.json({
      success: true,
      message: 'Call note deleted successfully',
    });
  } catch (error) {
    console.error('[API ERROR] DELETE /api/stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete call note',
      },
      { status: 500 }
    );
  }
}


