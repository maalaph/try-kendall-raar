import { searchUserRecords } from '@/lib/airtable';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('q'); // Query parameter: ?q=Ryan Maalouf or ?q=maaloufryan4@gmail.com

    if (!searchTerm) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Search term (q parameter) is required. Example: ?q=Ryan Maalouf or ?q=email@example.com' 
        },
        { status: 400 }
      );
    }

    const result = await searchUserRecords(searchTerm);

    // Format the response to show relevant fields
    const records = result.records?.map((record: any) => ({
      recordId: record.id,
      fullName: record.fields.fullName,
      email: record.fields.email,
      mobileNumber: record.fields.mobileNumber, // User's personal number for forwarding
      vapiNumber: record.fields.vapi_number, // VAPI phone number assigned to agent
      vapiAgentId: record.fields.vapi_agent_id,
      status: record.fields.status,
      forwardCalls: record.fields.forwardCalls,
      personality: record.fields.personality,
      userContext: record.fields.userContext,
      additionalInstructions: record.fields.additionalInstructions,
    })) || [];

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('[ERROR] checkUser failed:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search user records' 
      },
      { status: 500 }
    );
  }
}













