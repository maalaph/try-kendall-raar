import { NextRequest, NextResponse } from 'next/server';
import { getScheduledCallTasks, updateScheduledCallTask, getOwnerInfoByAgentId, getUserRecord, getOwnerPhoneByAgentId } from '@/lib/airtable';
import { getContactByPhone } from '@/lib/contacts';
import { buildVoicemailMessage, getStartSpeakingPlan, getVoicemailDetectionConfig } from '@/lib/callExperienceConfig';
// Import background executor to start it automatically
import '@/lib/backgroundCallExecutor';

const VAPI_API_URL = 'https://api.vapi.ai';

const getHeaders = () => {
  const apiKey = process.env.VAPI_PRIVATE_KEY;
  
  if (!apiKey) {
    throw new Error('VAPI_PRIVATE_KEY environment variable is not configured');
  }
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumberToE164(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `+${digits}`;
    }
    return null;
  }
  
  const digits = trimmed.replace(/\D/g, '');
  
  if (digits.length < 10) {
    return null;
  }
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  return `+1${digits}`;
}

/**
 * Extract recipient name from message or context
 * Looks for patterns like "Call [Name]", "call [Name]", "[Name]", etc.
 */
function extractRecipientName(message: string, callerName?: string): string | undefined {
  if (!message || typeof message !== 'string') return undefined;
  
  // Common patterns to extract names
  const patterns = [
    /(?:call|Call|CALL)\s+(?:my\s+)?(?:friend\s+)?([A-Z][a-z]+)/, // "Call Ali", "call my friend Ali"
    /(?:to|To|TO)\s+([A-Z][a-z]+)/, // "to Ali"
    /^([A-Z][a-z]+)(?:\s|,|\.|$)/, // Name at start of message
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Basic validation: name should be 2-20 characters and start with capital letter
      if (name.length >= 2 && name.length <= 20 && /^[A-Z]/.test(name)) {
        return name;
      }
    }
  }
  
  return undefined;
}

/**
 * Make an outbound call via VAPI API
 */
async function makeVAPICall(
  phoneNumber: string,
  assistantId: string,
  message: string,
  callerName?: string,
  phoneNumberId?: string,
  ownerInfo?: { fullName: string; kendallName: string } | null,
  recipientNameOverride?: string
): Promise<{ callId: string; status: string }> {
  const apiKey = process.env.VAPI_PRIVATE_KEY;
  if (!apiKey) {
    throw new Error('VAPI_PRIVATE_KEY environment variable is not configured');
  }

  // Get owner info if not provided
  let owner = ownerInfo;
  if (!owner) {
    owner = await getOwnerInfoByAgentId(assistantId);
    if (!owner) {
      console.warn('[EXECUTE-SCHEDULED-CALLS] Could not fetch owner info, using defaults');
      owner = { fullName: callerName || 'the owner', kendallName: 'Kendall' };
    }
  }
  const ownerPhone = await getOwnerPhoneByAgentId(assistantId);

  // Use recipient name from override if provided, otherwise extract from message
  const recipientName = recipientNameOverride || extractRecipientName(message, callerName);
  
  // Construct greeting for metadata
  // Format: "Hi [RecipientName], I'm [KendallName], [OwnerName]'s assistant. How are you?"
  const greeting = recipientName
    ? `Hi ${recipientName}, I'm ${owner.kendallName}, ${owner.fullName}'s assistant. How are you?`
    : `Hi there, I'm ${owner.kendallName}, ${owner.fullName}'s assistant. How are you?`;
  const voicemailMessage = buildVoicemailMessage({
    ownerName: owner.fullName,
    kendallName: owner.kendallName,
    message,
    ownerPhone,
    recipientName,
  });
  const startSpeakingPlan = getStartSpeakingPlan();
  const voicemailDetection = getVoicemailDetectionConfig();

  // Log outbound call configuration
  console.log('[EXECUTE-SCHEDULED-CALLS] Outbound call config:', {
    recipientName: recipientName || '(not extracted)',
    messagePreview: message.substring(0, 50),
    hasVoicemailMessage: !!voicemailMessage,
    hasVoicemailDetection: !!voicemailDetection,
  });

  const assistantOverrides: Record<string, any> = {
    // Note: prompt/systemPrompt/messages are NOT supported in assistantOverrides for /call
    // The base assistant prompt already references variableValues for outbound call handling
    firstMessage: null, // Belt-and-suspenders: ensure no stored greeting is spoken
    firstMessageMode: 'assistant-waits-for-user',
    variableValues: {
      isOutboundCall: 'true',
      greeting: '',
      recipientName: recipientName || '',
      message: message,
      ownerName: owner.fullName,
      kendallName: owner.kendallName,
      voicemailMessage,
      ownerPhone: ownerPhone || '',
    },
    voicemailDetection,
    voicemailMessage,
  };
  if (startSpeakingPlan) {
    assistantOverrides.startSpeakingPlan = startSpeakingPlan;
  }

  // Guardrail: prevent accidental greetings on outbound
  if (assistantOverrides.firstMessage !== null) {
    throw new Error('assistantOverrides.firstMessage must stay null for outbound calls');
  }
  if ((assistantOverrides.variableValues?.greeting || '').trim().length > 0) {
    throw new Error('assistantOverrides.variableValues.greeting must be empty for outbound calls');
  }

  const callPayload: any = {
    customer: {
      number: phoneNumber,
    },
    assistantId: assistantId,
    assistantOverrides,
    metadata: {
      message: message,
      callerName: callerName || owner.fullName,
      isOutboundCall: true,
      ownerName: owner.fullName,
      kendallName: owner.kendallName,
      greeting: '', // Keep empty to avoid any auto-played greeting
      recipientName: recipientName, // Recipient name if extracted
      ownerPhone,
    },
  };

  // Add phoneNumberId if provided (from Airtable), otherwise VAPI will use assistant's default
  if (phoneNumberId) {
    callPayload.phoneNumberId = phoneNumberId;
    console.log(`[EXECUTE-SCHEDULED-CALLS] Using phoneNumberId from Airtable: ${phoneNumberId}`);
  } else {
    console.warn('[EXECUTE-SCHEDULED-CALLS] No phoneNumberId provided, VAPI will use assistant default');
  }

  console.log('[EXECUTE-SCHEDULED-CALLS] Outbound call payload:', {
    phoneNumber,
    greeting,
    recipientName: recipientName || '(not extracted)',
    message: message.substring(0, 50) + '...',
    ownerName: owner.fullName,
    kendallName: owner.kendallName,
    isOutboundCall: 'true',
    voicemailMessage: voicemailMessage.substring(0, 60),
    hasStartSpeakingPlan: !!assistantOverrides.startSpeakingPlan,
  });
  
  console.log('[EXECUTE-SCHEDULED-CALLS] Full call payload:', JSON.stringify(callPayload, null, 2));
  
  // Verify payload structure for debugging
  console.log('[EXECUTE-SCHEDULED-CALLS] VERIFYING PAYLOAD STRUCTURE:', {
    firstMessageMode: assistantOverrides.firstMessageMode,
    hasVariableValues: !!assistantOverrides.variableValues,
    variableValuesMessage: assistantOverrides.variableValues?.message?.substring(0, 50) || 'MISSING',
    variableValuesRecipientName: assistantOverrides.variableValues?.recipientName || 'MISSING',
    variableValuesIsOutboundCall: assistantOverrides.variableValues?.isOutboundCall,
    hasVoicemailDetection: !!assistantOverrides.voicemailDetection,
    hasVoicemailMessage: !!assistantOverrides.voicemailMessage,
    hasStartSpeakingPlan: !!assistantOverrides.startSpeakingPlan,
  });

  const response = await fetch(`${VAPI_API_URL}/call`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(callPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[EXECUTE-SCHEDULED-CALLS] VAPI call failed:', errorData);
    throw new Error(`VAPI call failed: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  
  // Log the response to verify the call was created with correct settings
  console.log('[EXECUTE-SCHEDULED-CALLS] VAPI call created successfully:', {
    callId: result.id || result.callId,
    status: result.status,
    assistantId: result.assistantId || assistantId,
    // Check if response includes any prompt info (VAPI might echo back what it's using)
    hasAssistantOverrides: !!result.assistantOverrides,
  });
  
  return {
    callId: result.id || result.callId || '',
    status: result.status || 'initiated',
  };
}

/**
 * GET /api/execute-scheduled-calls
 * Executes scheduled calls that are due
 * This endpoint should be called periodically (e.g., via cron job)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[EXECUTE-SCHEDULED-CALLS] Checking for due scheduled calls...');
    
    // Get scheduled calls that are due
    const dueTasks = await getScheduledCallTasks();
    
    if (dueTasks.length === 0) {
      console.log('[EXECUTE-SCHEDULED-CALLS] No due calls found');
      return NextResponse.json({
        success: true,
        message: 'No due calls found',
        executed: 0,
      });
    }
    
    console.log(`[EXECUTE-SCHEDULED-CALLS] Found ${dueTasks.length} due call(s)`);
    
    const results = [];
    
    for (const task of dueTasks) {
      const taskId = task.id;
      const fields = task.fields || {};
      const phoneNumber = fields.phone_number;
      const message = fields.message;
      const ownerAgentId = fields.owner_agent_id;
      const callerName = fields.caller_name;
      const phoneNumberId = fields.phone_number_id; // Get stored phoneNumberId from Airtable
      const recipientName = fields.recipient_name; // Get recipient name if stored in task
      
      if (!phoneNumber || !message || !ownerAgentId) {
        console.warn('[EXECUTE-SCHEDULED-CALLS] Task missing required fields:', taskId);
        await updateScheduledCallTask(taskId, {
          status: 'failed',
          error_message: 'Missing required fields (phone_number, message, or owner_agent_id)',
        });
        results.push({ taskId, status: 'failed', error: 'Missing required fields' });
        continue;
      }
      
      // Update status to executing
      await updateScheduledCallTask(taskId, {
        status: 'executing',
      });
      
      try {
        // Format phone number
        const formattedPhone = formatPhoneNumberToE164(phoneNumber);
        if (!formattedPhone) {
          throw new Error('Invalid phone number format');
        }
        
        // Fetch owner info for the greeting
        const ownerInfo = await getOwnerInfoByAgentId(ownerAgentId);
        
        // If recipient name not stored, try to look it up by phone number
        let finalRecipientName = recipientName;
        if (!finalRecipientName && formattedPhone) {
          try {
            // Get user record by agentId (not recordId) - ownerAgentId is a VAPI agent ID
            const { getUserRecordByAgentId } = await import('@/lib/airtable');
            const userRecord = await getUserRecordByAgentId(ownerAgentId);
            if (userRecord && userRecord.id) {
              const contact = await getContactByPhone(userRecord.id, formattedPhone);
              if (contact && contact.name) {
                finalRecipientName = contact.name;
                console.log('[EXECUTE-SCHEDULED-CALLS] Found contact name via fallback lookup:', finalRecipientName);
              }
            } else {
              console.warn('[EXECUTE-SCHEDULED-CALLS] User record not found for ownerAgentId:', ownerAgentId);
            }
          } catch (error) {
            console.error('[EXECUTE-SCHEDULED-CALLS] Error in fallback contact lookup:', error);
            // Continue without recipient name - will extract from message
          }
        }
        
        // Make the call with stored phoneNumberId and owner info
        // Use recipient_name from task if available, otherwise from fallback lookup, otherwise extract from message
        const callResult = await makeVAPICall(
          formattedPhone,
          ownerAgentId,
          message,
          callerName,
          phoneNumberId, // Pass the stored phoneNumberId
          ownerInfo, // Pass owner info for greeting construction
          finalRecipientName // Pass recipient name if available from task or fallback lookup
        );
        
        // Update task as completed
        await updateScheduledCallTask(taskId, {
          status: 'completed',
          call_id: callResult.callId,
        });
        
        console.log(`[EXECUTE-SCHEDULED-CALLS] Successfully executed call for task ${taskId}`);
        results.push({
          taskId,
          status: 'completed',
          callId: callResult.callId,
        });
      } catch (error) {
        console.error(`[EXECUTE-SCHEDULED-CALLS] Error executing call for task ${taskId}:`, error);
        
        // Update task as failed
        await updateScheduledCallTask(taskId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
        
        results.push({
          taskId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${dueTasks.length} scheduled call(s)`,
      executed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (error) {
    console.error('[EXECUTE-SCHEDULED-CALLS] Exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/execute-scheduled-calls
 * Same as GET, but allows calling from cron jobs that require POST
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

