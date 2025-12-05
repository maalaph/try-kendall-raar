/**
 * Background Call Executor
 * Automatically checks for and executes scheduled calls every 5 seconds
 * Works in both development and production environments
 */

import { getScheduledCallTasks, updateScheduledCallTask, getOwnerInfoByAgentId, updateScheduledCallTaskAtomically, createOutboundCallRequest, getOwnerPhoneByAgentId } from '@/lib/airtable';
import { buildVoicemailMessage, getStartSpeakingPlan, getVoicemailDetectionConfig } from '@/lib/callExperienceConfig';

const VAPI_API_URL = 'https://api.vapi.ai';

let executionInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumberToE164(phone: string): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10) return `+${digits}`;
    return null;
  }
  
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
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
      console.warn('[BACKGROUND EXECUTOR] Could not fetch owner info, using defaults');
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
  console.log('[BACKGROUND EXECUTOR] Outbound call config:', {
    recipientName: recipientName || '(not extracted)',
    messagePreview: message.substring(0, 50),
    hasVoicemailMessage: !!voicemailMessage,
    hasVoicemailDetection: !!voicemailDetection,
  });

  const assistantOverrides: Record<string, any> = {
    // Note: prompt/systemPrompt/messages are NOT supported in assistantOverrides for /call
    // The base assistant prompt already references variableValues for outbound call handling
    firstMessageMode: 'assistant-waits-for-user',
    variableValues: {
      isOutboundCall: 'true',
      greeting: greeting,
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
      greeting: greeting, // Greeting stored in metadata for the assistant to use
      recipientName: recipientName, // Recipient name if extracted
      ownerPhone,
    },
  };

  // Add phoneNumberId if provided (from Airtable), otherwise VAPI will use assistant's default
  if (phoneNumberId) {
    callPayload.phoneNumberId = phoneNumberId;
    console.log(`[BACKGROUND EXECUTOR] Using phoneNumberId from Airtable: ${phoneNumberId}`);
  } else {
    console.warn('[BACKGROUND EXECUTOR] No phoneNumberId provided, VAPI will use assistant default');
  }

  console.log('[BACKGROUND EXECUTOR] Outbound call payload:', {
    phoneNumber,
    greeting,
    recipientName: recipientName || '(not extracted)',
    message: message.substring(0, 50) + '...',
    ownerName: owner.fullName,
    kendallName: owner.kendallName,
    isOutboundCall: 'true',
    voicemailMessage: voicemailMessage.substring(0, 60),
    startSpeakingPlan,
  });
  
  console.log('[BACKGROUND EXECUTOR] Full call payload:', JSON.stringify(callPayload, null, 2));
  
  // Add detailed payload verification logging
  console.log('[BACKGROUND EXECUTOR] VERIFYING PAYLOAD STRUCTURE:', {
    firstMessageMode: assistantOverrides.firstMessageMode,
    hasVariableValues: !!assistantOverrides.variableValues,
    variableValuesMessage: assistantOverrides.variableValues?.message?.substring(0, 50) || 'MISSING',
    variableValuesRecipientName: assistantOverrides.variableValues?.recipientName || 'MISSING',
    variableValuesIsOutboundCall: assistantOverrides.variableValues?.isOutboundCall,
    hasMetadata: !!callPayload.metadata,
    metadataMessage: callPayload.metadata?.message?.substring(0, 50) || 'MISSING',
    metadataIsOutboundCall: callPayload.metadata?.isOutboundCall,
    metadataRecipientName: callPayload.metadata?.recipientName || 'MISSING',
    hasVoicemailDetection: !!assistantOverrides.voicemailDetection,
    hasVoicemailMessage: !!assistantOverrides.voicemailMessage,
    hasStartSpeakingPlan: !!assistantOverrides.startSpeakingPlan,
  });

  const response = await fetch(`${VAPI_API_URL}/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(callPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[BACKGROUND EXECUTOR] VAPI call failed:', errorData);
    throw new Error(`VAPI call failed: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  
  // Log the response to verify the call was created with correct settings
  console.log('[BACKGROUND EXECUTOR] VAPI call created successfully:', {
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
 * Check for and execute due scheduled calls
 */
async function executeDueCalls() {
  try {
    const dueTasks = await getScheduledCallTasks();
    
    if (dueTasks.length === 0) {
      return; // No due calls, silently return
    }
    
    console.log(`[BACKGROUND EXECUTOR] Found ${dueTasks.length} due call(s), executing...`);
    
    for (const task of dueTasks) {
      const taskId = task.id;
      const fields = task.fields || {};
      const phoneNumber = fields.phone_number;
      const message = fields.message;
      const ownerAgentId = fields.owner_agent_id;
      const callerName = fields.caller_name;
      const phoneNumberId = fields.phone_number_id; // Get stored phoneNumberId from Airtable
      const recipientName = fields.recipient_name; // Get recipient name if stored in task
      const recordId = fields.recordId; // Get recordId for chat relay (optional)
      const threadId = fields.threadId; // Get threadId for chat relay (optional)
      
      console.log(`[BACKGROUND EXECUTOR] Processing task ${taskId} for ${phoneNumber}`);
      
      if (!phoneNumber || !message || !ownerAgentId) {
        console.warn('[BACKGROUND EXECUTOR] Task missing required fields:', taskId);
        await updateScheduledCallTask(taskId, {
          status: 'failed',
          error_message: 'Missing required fields (phone_number, message, or owner_agent_id)',
        });
        continue;
      }
      
      // CRITICAL: Atomically update status to 'executing' only if it's still 'pending'
      // This prevents race conditions where multiple instances try to process the same task
      // Add small random delay (0-100ms) to reduce chance of simultaneous updates
      const randomDelay = Math.floor(Math.random() * 100);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      let updateResult;
      try {
        updateResult = await updateScheduledCallTaskAtomically(taskId, 'executing');
      } catch (error) {
        console.log(`[BACKGROUND EXECUTOR] Task ${taskId} could not be updated to 'executing' (likely already being processed), skipping`);
        continue;
      }
      
      // If update didn't succeed (another instance already claimed it), skip this task
      if (!updateResult || updateResult.fields?.status !== 'executing') {
        console.log(`[BACKGROUND EXECUTOR] Task ${taskId} already being processed by another instance, skipping`);
        continue;
      }
      
      console.log(`[BACKGROUND EXECUTOR] Successfully claimed task ${taskId}, proceeding with call`);
      
      try {
        // Format phone number
        const formattedPhone = formatPhoneNumberToE164(phoneNumber);
        if (!formattedPhone) {
          throw new Error('Invalid phone number format');
        }
        
        // Fetch owner info for the greeting
        const ownerInfo = await getOwnerInfoByAgentId(ownerAgentId);
        
        // Make the call with stored phoneNumberId and owner info
        // Use recipient_name from task if available, otherwise extract from message
        const callResult = await makeVAPICall(
          formattedPhone,
          ownerAgentId,
          message,
          callerName,
          phoneNumberId, // Pass the stored phoneNumberId
          ownerInfo, // Pass owner info for greeting construction
          recipientName // Pass recipient name if available from task
        );
        
        // Create outbound call request for chat relay (if recordId and threadId are available)
        if (callResult.callId && recordId && threadId) {
          try {
            await createOutboundCallRequest({
              callId: callResult.callId,
              recordId: recordId,
              threadId: threadId,
              status: 'in-call',
              phoneNumber: formattedPhone,
            });
            console.log(`[BACKGROUND EXECUTOR] Created outbound call request for chat relay (callId: ${callResult.callId})`);
          } catch (error) {
            console.warn(`[BACKGROUND EXECUTOR] Failed to create outbound call request (non-critical):`, error);
            // Continue - this is optional for chat relay
          }
        } else {
          console.log(`[BACKGROUND EXECUTOR] Skipping outbound call request creation (missing callId: ${!!callResult.callId}, recordId: ${!!recordId}, threadId: ${!!threadId})`);
        }
        
        // Update task as completed
        await updateScheduledCallTask(taskId, {
          status: 'completed',
          call_id: callResult.callId,
        });
        
        console.log(`[BACKGROUND EXECUTOR] Successfully executed call for task ${taskId} (callId: ${callResult.callId})`);
      } catch (error) {
        console.error(`[BACKGROUND EXECUTOR] Error executing call for task ${taskId}:`, error);
        
        // Update task as failed
        await updateScheduledCallTask(taskId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  } catch (error) {
    // Don't log errors for every check to avoid spam
    // Only log if it's a real issue
    if (error instanceof Error && !error.message.includes('getScheduledCallTasks')) {
      console.error('[BACKGROUND EXECUTOR] Error checking for scheduled calls:', error.message);
    }
  }
}

/**
 * Start the background executor
 * Checks for due calls every 5 seconds
 */
export function startBackgroundExecutor() {
  // Prevent multiple instances
  if (isRunning) {
    console.log('[BACKGROUND EXECUTOR] Already running, skipping start');
    return;
  }
  
  console.log('[BACKGROUND EXECUTOR] Starting background call executor (checking every 5 seconds)');
  isRunning = true;
  
  // Execute immediately on start (in case there are due calls waiting)
  executeDueCalls();
  
  // Then check every 5 seconds
  executionInterval = setInterval(() => {
    executeDueCalls();
  }, 5000); // 5 seconds
}

/**
 * Stop the background executor
 */
export function stopBackgroundExecutor() {
  if (executionInterval) {
    clearInterval(executionInterval);
    executionInterval = null;
    isRunning = false;
    console.log('[BACKGROUND EXECUTOR] Stopped');
  }
}

// Auto-start in server environment (not in client/browser)
if (typeof window === 'undefined') {
  // Start automatically when module is imported in server context
  startBackgroundExecutor();
}

