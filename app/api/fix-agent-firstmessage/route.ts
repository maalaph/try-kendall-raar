import { NextRequest, NextResponse } from 'next/server';
import { getOwnerByPhoneNumber } from '@/lib/airtable';
import { updateAgentFromTemplate } from '@/lib/vapi';

/**
 * Quick fix endpoint to remove firstMessage from agent
 * Call this with: POST /api/fix-agent-firstmessage?phone=+18148528135
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone') || '+18148528135'; // Default to your number
    
    console.log('[FIX AGENT] Starting agent update to remove firstMessage for phone:', phoneNumber);
    
    // Get owner info from Airtable
    const ownerInfo = await getOwnerByPhoneNumber(phoneNumber);
    
    if (!ownerInfo) {
      return NextResponse.json({
        success: false,
        error: 'Owner not found in Airtable',
      }, { status: 404 });
    }
    
    // Get agent ID from Airtable or use the known one
    const agentId = ownerInfo.agentId || 'f6c6123b-8f88-43b7-a507-9a3e1f3d20a4';
    
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID not found. Please set vapi_agent_id in Airtable.',
      }, { status: 400 });
    }
    
    console.log('[FIX AGENT] Found owner:', {
      fullName: ownerInfo.fullName,
      agentId: agentId,
      recordId: ownerInfo.recordId,
    });
    
    // Get full user record to get all the data needed for update
    const { getUserRecord } = await import('@/lib/airtable');
    const userRecord = await getUserRecord(ownerInfo.recordId);
    const fields = userRecord.fields || {};
    
    // Ensure analyzedFileContent is a string
    let analyzedFileContent = fields.analyzedFileContent;
    if (analyzedFileContent && typeof analyzedFileContent !== 'string') {
      analyzedFileContent = String(analyzedFileContent);
    }
    
    // Ensure fileUsageInstructions is a string
    let fileUsageInstructions = fields.fileUsageInstructions;
    if (fileUsageInstructions && typeof fileUsageInstructions !== 'string') {
      fileUsageInstructions = String(fileUsageInstructions);
    }
    
    // Update agent with all existing data (this will remove firstMessage)
    const result = await updateAgentFromTemplate({
      agentId: agentId,
      fullName: ownerInfo.fullName,
      nickname: fields.nickname || undefined,
      kendallName: fields.kendallName || 'guwopski',
      mobileNumber: ownerInfo.mobileNumber,
      selectedTraits: Array.isArray(fields.personalityChoices) ? fields.personalityChoices : [],
      useCaseChoice: fields.useCaseChoice || 'Handling all types of calls across personal, professional, and business contexts.',
      boundaryChoices: Array.isArray(fields.boundaries) ? fields.boundaries : [],
      userContextAndRules: fields.userContext || '',
      forwardCalls: fields.forwardCalls || false,
      voiceChoice: fields.voiceChoice || undefined,
      analyzedFileContent: analyzedFileContent || undefined,
      fileUsageInstructions: fileUsageInstructions || undefined,
    });
    
    console.log('[FIX AGENT] Agent updated successfully:', {
      agentId: result.id || agentId,
      firstMessage: result.firstMessage,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Agent updated successfully. firstMessage has been removed.',
      agentId: result.id || agentId,
      firstMessage: result.firstMessage,
    });
    
  } catch (error) {
    console.error('[FIX AGENT] Error updating agent:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

