import { NextRequest, NextResponse } from 'next/server';
import { getScheduledCallTasks, updateScheduledCallTask } from '@/lib/airtable';
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
 * Make an outbound call via VAPI API
 */
async function makeVAPICall(
  phoneNumber: string,
  assistantId: string,
  message: string,
  callerName?: string,
  phoneNumberId?: string
): Promise<{ callId: string; status: string }> {
  const callPayload: any = {
    customer: {
      number: phoneNumber,
    },
    assistantId: assistantId,
    metadata: {
      message: message,
      callerName: callerName || 'the owner',
    },
  };

  // Add phoneNumberId if provided (from Airtable), otherwise VAPI will use assistant's default
  if (phoneNumberId) {
    callPayload.phoneNumberId = phoneNumberId;
    console.log(`[EXECUTE-SCHEDULED-CALLS] Using phoneNumberId from Airtable: ${phoneNumberId}`);
  } else {
    console.warn('[EXECUTE-SCHEDULED-CALLS] No phoneNumberId provided, VAPI will use assistant default');
  }

  const response = await fetch(`${VAPI_API_URL}/call`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(callPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`VAPI call failed: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
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
        
        // Make the call with stored phoneNumberId
        const callResult = await makeVAPICall(
          formattedPhone,
          ownerAgentId,
          message,
          callerName,
          phoneNumberId // Pass the stored phoneNumberId
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

