import { NextRequest, NextResponse } from 'next/server';
import { getOwnerPhoneByAgentId, createCallNote, getOwnerByPhoneNumber, createScheduledCallTask, getAgentByCanadianNumber, getCanadianNumberByAgentId, getUserRecord, getOutboundCallRequestByCallId, updateOutboundCallRequest, createChatMessage, getAllUserRecords } from '@/lib/airtable';
import { sendSMS } from '@/lib/sms';
import { parseTimeExpression } from '@/lib/timeParser';
import { buildSystemPrompt } from '@/lib/promptBlocks';
// Import background executor and explicitly start it
import { startBackgroundExecutor } from '@/lib/backgroundCallExecutor';
import { extractPatternsFromMessage } from '@/lib/patternExtractor';
import { getOrCreateThreadId } from '@/lib/airtable';
import OpenAI from 'openai';
import { getUserContext, getUserContacts, getUserMemory, getUserDocuments } from '@/lib/contextRetrieval';

const VAPI_API_URL = 'https://api.vapi.ai';

// Function definitions for OpenAI function calling
const SMS_FUNCTIONS = [
  {
    name: 'make_outbound_call',
    description: 'Make an outbound call to a specified phone number and deliver a message on behalf of the owner. Use this when the owner requests an immediate call.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call in E.164 format (e.g., +14155551234)',
        },
        message: {
          type: 'string',
          description: 'The message to deliver during the call',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The name of the person making the request (the owner)',
        },
      },
      required: ['phone_number', 'message'],
    },
  },
  {
    name: 'schedule_outbound_call',
    description: 'Schedule an outbound call to a specified phone number for a future date/time. Use this when the owner requests a call to be made at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call in E.164 format (e.g., +14155551234)',
        },
        message: {
          type: 'string',
          description: 'The message to deliver during the call',
        },
        scheduled_time: {
          type: 'string',
          description: 'ISO 8601 format timestamp for when the call should be made',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The name of the person making the request (the owner)',
        },
      },
      required: ['phone_number', 'message', 'scheduled_time'],
    },
  },
  {
    name: 'capture_note',
    description: 'Call this function when the caller wants to leave a message or asks you to pass something along to the owner.',
    parameters: {
      type: 'object',
      properties: {
        note_content: {
          type: 'string',
          description: 'The message or note that the caller wants to leave',
        },
        caller_phone: {
          type: 'string',
          description: 'The caller\'s phone number',
        },
      },
      required: ['note_content', 'caller_phone'],
    },
  },
];

// Singleton flag to ensure background executor starts only once
let backgroundExecutorStarted = false;

// Function to ensure background executor is started (called from POST handler)
function ensureBackgroundExecutorStarted() {
  if (!backgroundExecutorStarted && typeof window === 'undefined') {
    console.log('[VAPI WEBHOOK] Starting background executor on first webhook call...');
    startBackgroundExecutor();
    backgroundExecutorStarted = true;
    console.log('[VAPI WEBHOOK] Background executor started successfully');
  }
}

/**
 * Generate SMS response using OpenAI with agent's system prompt and function calling
 * Returns both the text response and any function calls that need to be executed
 */
async function generateSMSResponse(
  agentRecordId: string,
  incomingMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{ response: string; functionCalls?: Array<{ name: string; arguments: any }> }> {
  try {
    console.log('[SMS] Generating response for agent record:', agentRecordId);
    
    // Get agent data from Airtable
    const agentRecord = await getUserRecord(agentRecordId);
    if (!agentRecord || !agentRecord.fields) {
      throw new Error('Agent record not found');
    }
    
    const fields = agentRecord.fields;
    const fullName = fields.fullName;
    const nickname = fields.nickname;
    const kendallName = fields.kendallName || 'Kendall';
    const selectedTraits = Array.isArray(fields.selectedTraits) ? fields.selectedTraits : [];
    const useCaseChoice = fields.useCaseChoice || 'Mixed / Everything';
    const boundaryChoices = Array.isArray(fields.boundaryChoices) ? fields.boundaryChoices : [];
    const userContextAndRules = fields.userContextAndRules || '';
    const analyzedFileContent = fields.analyzedFileContent || '';
    const fileUsageInstructions = fields.fileUsageInstructions || '';
    const mobileNumber = fields.mobileNumber;
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      kendallName: String(kendallName),
      fullName: String(fullName),
      nickname: nickname ? String(nickname) : undefined,
      selectedTraits: selectedTraits.map(String),
      useCaseChoice: String(useCaseChoice),
      boundaryChoices: boundaryChoices.map(String),
      userContextAndRules: String(userContextAndRules),
      analyzedFileContent: analyzedFileContent ? String(analyzedFileContent) : undefined,
      fileUsageInstructions: fileUsageInstructions ? String(fileUsageInstructions) : undefined,
      ownerPhoneNumber: mobileNumber ? String(mobileNumber) : undefined,
    });
    
    // Add SMS-specific instructions to system prompt
    const smsSystemPrompt = `${systemPrompt}

=== SMS-SPECIFIC INSTRUCTIONS ===
- You are responding via SMS, so keep responses concise (under 160 characters when possible, but can be longer if needed)
- You can handle the same functions as voice calls: make_outbound_call, schedule_outbound_call, capture_note
- For outbound call requests, use the appropriate function (make_outbound_call for immediate, schedule_outbound_call for scheduled)
- For message forwarding, use capture_note function
- Be conversational and natural, but efficient
- If the message is for the owner, use capture_note to forward it`;
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: smsSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: incomingMessage },
    ];
    
    // Generate response with function calling enabled (using tools format for newer API)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      tools: SMS_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn,
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const message = completion.choices[0]?.message;
    const response = message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    
    // Check for function calls (OpenAI uses tool_calls in newer API)
    const functionCalls: Array<{ name: string; arguments: any }> = [];
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        try {
          const args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments;
          if (tc.function?.name) {
            functionCalls.push({
              name: tc.function.name,
              arguments: args || {},
            });
          }
        } catch (e) {
          console.error('[SMS ERROR] Failed to parse function call arguments:', e);
        }
      }
    } else if (message?.function_call) {
      // Fallback for older API format
      try {
        const args = typeof message.function_call.arguments === 'string' 
          ? JSON.parse(message.function_call.arguments) 
          : message.function_call.arguments;
        if (message.function_call.name) {
          functionCalls.push({
            name: message.function_call.name,
            arguments: args || {},
          });
        }
      } catch (e) {
        console.error('[SMS ERROR] Failed to parse function call arguments:', e);
      }
    }
    
    console.log('[SMS] Generated response:', response);
    if (functionCalls.length > 0) {
      console.log('[SMS] Function calls detected:', functionCalls);
    }
    
    return { response, functionCalls: functionCalls.length > 0 ? functionCalls : undefined };
  } catch (error) {
    console.error('[SMS ERROR] Failed to generate SMS response:', error);
    throw error;
  }
}

/**
 * Handle SMS events (incoming SMS messages)
 */
async function handleSMSEvent(payload: any, request: NextRequest) {
  try {
    console.log('[SMS] ===== SMS EVENT HANDLER CALLED =====');
    console.log('[SMS] Full payload:', JSON.stringify(payload, null, 2));
    
    // Extract SMS data - handle both VAPI and Twilio formats
    let fromNumber: string | undefined;
    let toNumber: string | undefined;
    let messageBody: string | undefined;
    let assistantId: string | undefined;
    
    // Check for VAPI SMS format
    if (payload.message?.from || payload.from) {
      fromNumber = payload.message?.from || payload.from;
      toNumber = payload.message?.to || payload.to;
      messageBody = payload.message?.body || payload.body || payload.text || payload.content;
      assistantId = payload.assistant?.id || payload.assistantId || payload.assistant_id;
    }
    // Check for Twilio SMS webhook format
    else if (payload.From && payload.To && payload.Body) {
      fromNumber = payload.From;
      toNumber = payload.To;
      messageBody = payload.Body;
    }
    
    if (!fromNumber || !toNumber || !messageBody) {
      console.error('[SMS ERROR] Missing required SMS data:', {
        hasFrom: !!fromNumber,
        hasTo: !!toNumber,
        hasBody: !!messageBody,
      });
      return NextResponse.json(
        { success: false, error: 'Missing required SMS data' },
        { status: 400 }
      );
    }
    
    console.log('[SMS] Extracted SMS data:', {
      from: fromNumber,
      to: toNumber,
      body: messageBody,
      assistantId,
    });
    
    // Find agent by Canadian phone number (to number)
    const agentInfo = await getAgentByCanadianNumber(toNumber);
    if (!agentInfo) {
      console.error('[SMS ERROR] Could not find agent for Canadian number:', toNumber);
      return NextResponse.json(
        { success: false, error: 'Agent not found for this number' },
        { status: 404 }
      );
    }
    
    console.log('[SMS] Found agent:', {
      agentId: agentInfo.agentId,
      fullName: agentInfo.fullName,
      recordId: agentInfo.recordId,
    });
    
    // Get agent's Canadian number for sending response
    const canadianNumberInfo = await getCanadianNumberByAgentId(agentInfo.agentId);
    const canadianPhoneNumber = canadianNumberInfo?.phoneNumber;
    
    if (!canadianPhoneNumber) {
      console.error('[SMS ERROR] Could not find Canadian phone number for agent:', agentInfo.agentId);
      return NextResponse.json(
        { success: false, error: 'Canadian phone number not found for agent' },
        { status: 500 }
      );
    }
    
    // Get agent record to check owner's phone number
    const agentRecord = await getUserRecord(agentInfo.recordId);
    const ownerPhoneNumber = agentRecord?.fields?.mobileNumber;
    
    // Check if sender is the owner (for personalized greeting)
    const formatPhoneNumberToE164 = (phone: string): string | null => {
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
      return `+1${digits}`;
    };
    
    const isOwner = ownerPhoneNumber && fromNumber && 
      formatPhoneNumberToE164(String(ownerPhoneNumber)) === formatPhoneNumberToE164(fromNumber);
    
    // Add owner context to the message if they are the owner
    let contextualMessage = messageBody;
    if (isOwner) {
      contextualMessage = `[OWNER MESSAGE - This is the owner texting you] ${messageBody}`;
      console.log('[SMS] Sender is the owner, adding owner context');
    } else {
      console.log('[SMS] Sender is NOT the owner');
    }
    
    // Generate SMS response using OpenAI (with function calling support)
    // TODO: Implement conversation history storage/retrieval for context
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const { response: responseText, functionCalls } = await generateSMSResponse(agentInfo.recordId, contextualMessage, conversationHistory);
    
    // Execute function calls if any
    let functionResults: string[] = [];
    if (functionCalls && functionCalls.length > 0) {
      console.log('[SMS] Executing function calls:', functionCalls);
      
      for (const fc of functionCalls) {
        try {
          if (fc.name === 'make_outbound_call') {
            const { phone_number, message, caller_name } = fc.arguments;
            // Format phone number
            const formatPhoneNumberToE164 = (phone: string): string | null => {
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
              return `+1${digits}`;
            };
            
            const formattedPhone = formatPhoneNumberToE164(phone_number);
            if (!formattedPhone) {
              functionResults.push('Error: Invalid phone number format');
              continue;
            }
            
            // Schedule call for immediate execution (3 seconds from now)
            const scheduledTime = new Date(Date.now() + 3 * 1000).toISOString();
            await createScheduledCallTask({
              phone_number: formattedPhone,
              message: message || '',
              scheduled_time: scheduledTime,
              owner_agent_id: agentInfo.agentId,
              caller_name: caller_name || agentInfo.fullName,
              phone_number_id: agentInfo.vapiPhoneNumberId || undefined,
              status: 'pending',
            });
            
            functionResults.push(`Call scheduled to ${phone_number}`);
            console.log('[SMS] Scheduled outbound call:', formattedPhone);
          } else if (fc.name === 'schedule_outbound_call') {
            const { phone_number, message, scheduled_time, caller_name } = fc.arguments;
            // Format phone number
            const formatPhoneNumberToE164 = (phone: string): string | null => {
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
              return `+1${digits}`;
            };
            
            const formattedPhone = formatPhoneNumberToE164(phone_number);
            if (!formattedPhone) {
              functionResults.push('Error: Invalid phone number format');
              continue;
            }
            
            // Parse scheduled time
            const parsedTime = parseTimeExpression(scheduled_time) || scheduled_time;
            await createScheduledCallTask({
              phone_number: formattedPhone,
              message: message || '',
              scheduled_time: parsedTime,
              owner_agent_id: agentInfo.agentId,
              caller_name: caller_name || agentInfo.fullName,
              phone_number_id: agentInfo.vapiPhoneNumberId || undefined,
              status: 'pending',
            });
            
            functionResults.push(`Call scheduled to ${phone_number} for ${scheduled_time}`);
            console.log('[SMS] Scheduled outbound call:', formattedPhone, parsedTime);
          } else if (fc.name === 'capture_note') {
            const { note_content, caller_phone } = fc.arguments;
            // Get owner phone
            const ownerPhone = await getOwnerPhoneByAgentId(agentInfo.agentId);
            if (ownerPhone) {
              // Create note in Airtable
              await createCallNote({
                agentId: agentInfo.agentId,
                callerPhone: caller_phone || fromNumber,
                note: note_content || '',
                smsSent: false, // Will send SMS below
              });
              
              // Send SMS to owner
              const smsMessage = `Kendall here — you received a new message.\n\nFrom: ${caller_phone || fromNumber}\n\nMessage: ${note_content}`;
              await sendSMS(ownerPhone, smsMessage, canadianPhoneNumber);
              
              functionResults.push('Message forwarded to owner');
              console.log('[SMS] Captured note and forwarded to owner');
            } else {
              functionResults.push('Note saved (could not send to owner - phone not found)');
            }
          }
        } catch (error) {
          console.error(`[SMS ERROR] Failed to execute function ${fc.name}:`, error);
          functionResults.push(`Error executing ${fc.name}`);
        }
      }
    }
    
    // Combine response text with function results
    let finalResponse = responseText;
    if (functionResults.length > 0) {
      finalResponse = `${responseText}\n\n${functionResults.join('\n')}`;
    }
    
    // Send SMS response
    const smsResult = await sendSMS(fromNumber, finalResponse, canadianPhoneNumber);
    
    if (!smsResult.success) {
      console.error('[SMS ERROR] Failed to send SMS response:', smsResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to send SMS response', details: smsResult.error },
        { status: 500 }
      );
    }
    
    console.log('[SMS] Successfully sent SMS response:', {
      to: fromNumber,
      from: canadianPhoneNumber,
      messageId: smsResult.messageSid,
    });
    
    // Return success response
    // For Twilio webhooks, return TwiML or empty response
    if (payload.From && payload.To) {
      // Twilio webhook format - return empty TwiML
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    // For VAPI webhooks, return JSON
    return NextResponse.json({
      success: true,
      message: 'SMS processed and response sent',
      messageSid: smsResult.messageSid,
    });
    
  } catch (error) {
    console.error('[SMS ERROR] Exception in handleSMSEvent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error processing SMS',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle function call events (real-time function execution)
 */
interface CallMetrics {
  toolCalls: Array<{ name: string; latency: number; success: boolean }>;
  toolRecalls: number;
  functionFailures: number;
}

async function handleFunctionCallEvent(
  payload: any, 
  request: NextRequest,
  callMetrics?: CallMetrics
) {
  const startTime = Date.now();
  try {
    console.log('[VAPI WEBHOOK] ===== handleFunctionCallEvent CALLED =====');
    console.log('[VAPI WEBHOOK] Event type:', payload.type || payload.event || payload.message?.type);
    console.log('[VAPI WEBHOOK] Payload keys:', Object.keys(payload));
    console.log('[VAPI WEBHOOK] Has messages:', !!payload.messages);
    console.log('[VAPI WEBHOOK] Has message.messages:', !!payload.message?.messages);
    console.log('[VAPI WEBHOOK] Has message.artifact:', !!payload.message?.artifact);
    console.log('[VAPI WEBHOOK] Has message.artifact.messages:', !!payload.message?.artifact?.messages);
    
    // Log critical payload paths for extraction
    console.log('[VAPI WEBHOOK] Payload extraction paths:', {
      'payload.assistant?.id': payload.assistant?.id,
      'payload.assistantId': payload.assistantId,
      'payload.call?.assistantId': payload.call?.assistantId,
      'payload.message?.call?.assistantId': payload.message?.call?.assistantId,
      'payload.customer?.number': payload.customer?.number,
      'payload.call?.customer?.number': payload.call?.customer?.number,
      'payload.message?.call?.customer?.number': payload.message?.call?.customer?.number,
    });
    
    console.log('[VAPI WEBHOOK] Full payload:', JSON.stringify(payload, null, 2));
    
    // VAPI might send function calls in different formats
    // Try multiple possible structures - check for toolCalls in messages first (most common)
    let functionCall = null;
    let functionName = null;
    let functionArgs = {};
    
    // Check if function call is in messages array (real-time function calls)
    // VAPI sends function calls in various nested structures, especially in speech-update events
    const messagesArray = 
      payload.messages || 
      payload.message?.messages || 
      payload.message?.artifact?.messages || 
      [];
    
    console.log('[VAPI WEBHOOK] Checking for function calls in messages:', {
      hasPayloadMessages: !!payload.messages,
      hasMessageMessages: !!payload.message?.messages,
      hasArtifactMessages: !!payload.message?.artifact?.messages,
      messagesArrayLength: messagesArray.length,
    });
    
    if (Array.isArray(messagesArray)) {
      for (const msg of messagesArray) {
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const toolCall of msg.toolCalls) {
            if (toolCall.function?.name) {
              functionCall = toolCall;
              functionName = toolCall.function.name;
              functionArgs = toolCall.function.arguments || {};
              console.log('[VAPI WEBHOOK] Found function call in messages array:', {
                functionName,
                hasArgs: !!functionArgs,
                source: payload.messages ? 'payload.messages' : 
                       payload.message?.messages ? 'payload.message.messages' : 
                       payload.message?.artifact?.messages ? 'payload.message.artifact.messages' : 'unknown',
              });
              break;
            }
          }
        }
        if (functionName) break;
      }
    }
    
    // Fallback to other possible structures
    if (!functionName) {
      // Check direct function call structure (VAPI real-time format)
      functionCall = 
        payload.functionCall || 
        payload.function_call || 
        payload.call?.functionCall ||
        payload.message?.functionCall ||
        payload.function ||
        payload;
      
      functionName = 
        functionCall.name || 
        functionCall.function?.name ||
        functionCall.functionName ||
        payload.functionName ||
        payload.name;
      
      functionArgs = 
        functionCall.arguments || 
        functionCall.function?.arguments || 
        functionCall.params ||
        payload.arguments ||
        payload.params ||
        {};
      
      if (functionName) {
        console.log('[VAPI WEBHOOK] Found function call in direct structure:', {
          functionName,
          hasArgs: !!functionArgs,
        });
      }
    }
    
    console.log('[VAPI WEBHOOK] Extracted function call:', {
      functionName,
      hasArgs: !!functionArgs,
      argsType: typeof functionArgs,
      functionCallStructure: functionCall ? Object.keys(functionCall) : 'none',
    });
    
    if (!functionName) {
      // Extract toolCallId for proper error response format
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         payload.message?.artifact?.messages?.find((m: any) => m.toolCalls)?.[0]?.id ||
                         '';
      
      console.error('[VAPI WEBHOOK] No function name found in payload', {
        toolCallId: toolCallId || '(NOT FOUND)',
        payloadKeys: Object.keys(payload),
      });
      
      return NextResponse.json({
        results: [
          {
            toolCallId: toolCallId,
            result: 'Error: Function name not found in request. Please check the function name and try again.',
          }
        ]
      });
    }
    
    // Parse arguments if they're a string
    let args: Record<string, any> = functionArgs as Record<string, any>;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (e) {
        // Extract toolCallId for proper error response format
        const toolCallId = functionCall?.id || 
                           functionCall?.toolCallId || 
                           payload?.toolCallId ||
                           '';
        
        console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error: Failed to parse function arguments. Please check the function parameters and try again.',
            }
          ]
        });
      }
    }
    
    const assistantId = 
      payload.assistant?.id || 
      payload.assistantId || 
      payload.assistant_id ||
      payload.call?.assistantId ||
      payload.message?.call?.assistantId ||  // speech-update events
      payload.message?.assistant?.id ||      // alternative structure
      '';
    
    // Extract caller phone number from multiple possible locations
    const callerPhoneNumber = 
      payload.customer?.number || 
      payload.customer?.phone || 
      payload.call?.customer?.number ||
      payload.message?.call?.customer?.number ||  // speech-update events
      payload.message?.customer?.number ||        // alternative structure
      payload.caller?.number ||                   // alternative structure
      payload.caller?.phone ||                    // alternative structure
      '';
    
    // Extract phoneNumberId from payload (for real-time function calls)
    const phoneNumberId = 
      payload.phoneNumber?.id ||
      payload.assistant?.phoneNumberId ||
      null;
    
    // Debug logging to see actual payload structure
    console.log('[VAPI WEBHOOK] Payload structure check:', {
      hasAssistant: !!payload.assistant,
      hasAssistantId: !!payload.assistantId,
      hasCall: !!payload.call,
      hasCallAssistantId: !!payload.call?.assistantId,
      hasCustomer: !!payload.customer,
      hasCustomerNumber: !!payload.customer?.number,
      hasCallCustomer: !!payload.call?.customer,
      hasMessageCall: !!payload.message?.call,
      hasMessageCustomer: !!payload.message?.customer,
      hasCaller: !!payload.caller,
      callAssistantId: payload.call?.assistantId,
      customerNumber: payload.customer?.number,
      messageCallAssistantId: payload.message?.call?.assistantId,
      messageCustomerNumber: payload.message?.customer?.number,
      callerNumber: payload.caller?.number,
      // Log full payload structure for debugging
      payloadKeys: Object.keys(payload),
      messageKeys: payload.message ? Object.keys(payload.message) : [],
      callKeys: payload.call ? Object.keys(payload.call) : [],
    });
    
    console.log('[VAPI WEBHOOK] Extracted context:', {
      assistantId,
      callerPhoneNumber: callerPhoneNumber || '(NOT FOUND)',
      functionName,
    });
    
    // Check if caller is owner
    let ownerInfo = null;
    if (callerPhoneNumber) {
      ownerInfo = await getOwnerByPhoneNumber(callerPhoneNumber);
      console.log('[VAPI WEBHOOK] Owner lookup result:', {
        found: !!ownerInfo,
        ownerName: ownerInfo?.fullName,
        ownerAgentId: ownerInfo?.agentId,
        ownerAgentIdType: typeof ownerInfo?.agentId,
        ownerAgentIdIsEmpty: ownerInfo?.agentId === '' || ownerInfo?.agentId === null || ownerInfo?.agentId === undefined,
        callerAgentId: assistantId,
        callerAgentIdType: typeof assistantId,
        phoneMatch: !!ownerInfo,
        agentIdMatch: ownerInfo?.agentId ? ownerInfo.agentId === assistantId : 'N/A (agentId not set)',
        willPassVerification: ownerInfo ? (ownerInfo.agentId ? ownerInfo.agentId === assistantId : true) : false,
      });
    } else {
      console.error('[VAPI WEBHOOK] CRITICAL: No caller phone number found in payload. Cannot verify owner.');
      console.log('[VAPI WEBHOOK] Full payload for debugging:', JSON.stringify(payload, null, 2).substring(0, 2000));
    }
    
    console.log('[VAPI WEBHOOK] Function call event:', {
      functionName,
      assistantId,
      isOwner: !!ownerInfo && ownerInfo.agentId === assistantId,
      callerPhone: callerPhoneNumber,
    });
    
    // Handle check_if_owner function
    if (functionName === 'check_if_owner') {
      // Extract toolCallId from functionCall - VAPI requires this in the response
      // Declare once at the top of the handler
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      try {
        console.log('[VAPI WEBHOOK] ===== check_if_owner FUNCTION CALLED =====');
        console.log('[VAPI WEBHOOK] Caller phone number:', callerPhoneNumber || '(NOT FOUND)');
        console.log('[VAPI WEBHOOK] Assistant ID:', assistantId || '(NOT FOUND)');
        console.log('[VAPI WEBHOOK] Extracted toolCallId:', toolCallId || '(NOT FOUND)');
        
        // Try alternative extraction if initial extraction failed
        let finalCallerPhone = callerPhoneNumber;
        if (!finalCallerPhone) {
          console.warn('[VAPI WEBHOOK] Caller phone not found in initial extraction, trying alternative extraction...');
          finalCallerPhone = 
            payload.from?.number ||
            payload.from?.phone ||
            payload.phoneNumber?.number ||
            payload.phone?.number ||
            '';
          if (finalCallerPhone) {
            console.log('[VAPI WEBHOOK] Found caller phone via alternative extraction:', finalCallerPhone);
            // Re-lookup owner with the newly found phone number
            ownerInfo = await getOwnerByPhoneNumber(finalCallerPhone);
          }
        }
        
        if (!finalCallerPhone) {
          console.error('[VAPI WEBHOOK] check_if_owner called but caller phone number not found in any location');
          console.log('[VAPI WEBHOOK] Full payload structure:', JSON.stringify(payload, null, 2).substring(0, 2000));
          // VAPI format: { results: [{ toolCallId: "...", result: "..." }] }
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: 'Caller phone number not available. Treat as regular caller.',
              }
            ]
          });
        }
      
      // Check if caller is owner
      // If getOwnerByPhoneNumber found a match, the caller IS the owner (we matched by phone number)
      // Additionally verify agentId matches if it's set in Airtable (for extra security)
      if (ownerInfo) {
        console.log('[VAPI WEBHOOK] Owner info from Airtable:', {
          fullName: ownerInfo.fullName,
          mobileNumber: ownerInfo.mobileNumber,
          agentId: ownerInfo.agentId,
          agentIdType: typeof ownerInfo.agentId,
          agentIdIsEmpty: ownerInfo.agentId === '' || ownerInfo.agentId === null || ownerInfo.agentId === undefined,
          assistantId: assistantId,
        });
        
        // If agentId is set in Airtable, verify it matches the assistantId
        // If agentId is not set, we trust the phone number match (ownerInfo was found by phone number)
        // IMPORTANT: If agentId is empty string, null, or undefined, treat it as "not set"
        const agentIdIsSet = ownerInfo.agentId && 
                            ownerInfo.agentId !== '' && 
                            ownerInfo.agentId !== null && 
                            ownerInfo.agentId !== undefined;
        
        const isOwnerMatch = agentIdIsSet
          ? ownerInfo.agentId === assistantId 
          : true; // Phone number match is sufficient if agentId not set
        
        if (isOwnerMatch) {
          console.log('[VAPI WEBHOOK] ✅ OWNER IDENTIFIED:', {
            fullName: ownerInfo.fullName,
            callerPhone: finalCallerPhone,
            agentId: assistantId,
            ownerAgentId: ownerInfo.agentId,
            matchType: agentIdIsSet ? 'agentId_match' : 'phone_number_match',
            verificationMethod: agentIdIsSet ? 'agentId + phone' : 'phone only',
          });
          const responseTime = Date.now() - startTime;
          console.log('[VAPI WEBHOOK] check_if_owner response time:', responseTime, 'ms');
          
          // VAPI requires response in this format: { results: [{ toolCallId: "...", result: "..." }] }
          // Result must be a single-line string (no line breaks)
          const resultText = `The caller IS the owner. Owner name: ${ownerInfo.fullName}. You should greet them by name using their nickname from your system prompt and allow outbound calls. Remember this for the entire call - this caller is verified as the owner.`;
          
          const response = {
            results: [
              {
                toolCallId: toolCallId,
                result: resultText,
              }
            ]
          };
          
          console.log('[VAPI WEBHOOK] ===== SENDING OWNER RECOGNITION RESPONSE =====');
          console.log('[VAPI WEBHOOK] Response format: VAPI results array');
          console.log('[VAPI WEBHOOK] ToolCallId:', toolCallId);
          console.log('[VAPI WEBHOOK] Response:', resultText);
          
          return NextResponse.json(response);
        } else {
          console.warn('[VAPI WEBHOOK] Phone number matches owner but agentId mismatch:', {
            callerPhone: finalCallerPhone,
            assistantId: assistantId,
            ownerAgentId: ownerInfo.agentId,
            ownerName: ownerInfo.fullName,
            reason: 'Phone matches but agentId does not match assistantId',
          });
        }
      }
      
      // Not owner
      console.log('[VAPI WEBHOOK] ❌ Caller is NOT owner:', {
        callerPhone: finalCallerPhone,
        agentId: assistantId,
        foundOwnerInfo: !!ownerInfo,
        ownerAgentId: ownerInfo?.agentId,
        phoneMatch: !!ownerInfo,
        agentIdMatch: ownerInfo?.agentId ? (ownerInfo.agentId === assistantId) : 'N/A',
      });
      
      // VAPI format: { results: [{ toolCallId: "...", result: "..." }] }
      // Result must be a single-line string
      const notOwnerResponse = {
        results: [
          {
            toolCallId: toolCallId,
            result: 'The caller is NOT the owner. This is a regular caller. Greet them normally and do not allow outbound calls.',
          }
        ]
      };
      console.log('[VAPI WEBHOOK] Returning not-owner response');
      return NextResponse.json(notOwnerResponse);
      } catch (error) {
        console.error('[VAPI WEBHOOK] Error in check_if_owner handler:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        // VAPI format: { results: [{ toolCallId: "...", result: "..." }] }
        // Result must be a single-line string
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error checking owner status. Please try again. Treat caller as regular caller for now.',
            }
          ]
        });
      }
    }
    
    // Handle make_outbound_call function
    if (functionName === 'make_outbound_call') {
      // Extract toolCallId from functionCall - VAPI requires this in the response
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      console.log('[VAPI WEBHOOK] ===== make_outbound_call FUNCTION CALLED =====');
      console.log('[VAPI WEBHOOK] Function detection successful, entering handler');
      console.log('[VAPI WEBHOOK] Extracted toolCallId:', toolCallId || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Function args:', JSON.stringify(args, null, 2));
      console.log('[VAPI WEBHOOK] Caller phone number:', callerPhoneNumber || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Assistant ID:', assistantId || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Owner info found:', !!ownerInfo);
      console.log('[VAPI WEBHOOK] FunctionCall structure:', JSON.stringify({
        hasFunctionCall: !!functionCall,
        functionCallKeys: functionCall ? Object.keys(functionCall) : [],
        functionCallId: functionCall?.id,
      }));
      
      try {
      
      // CRITICAL: If we don't have a caller phone number, try to extract it from the payload again
      // This can happen if the phone number wasn't extracted correctly the first time
      let finalCallerPhone = callerPhoneNumber;
      if (!finalCallerPhone) {
        console.warn('[VAPI WEBHOOK] Caller phone not found in initial extraction, trying alternative extraction...');
        // Try more extraction paths
        finalCallerPhone = 
          payload.from?.number ||
          payload.from?.phone ||
          payload.phoneNumber?.number ||
          payload.phone?.number ||
          '';
        if (finalCallerPhone) {
          console.log('[VAPI WEBHOOK] Found caller phone via alternative extraction:', finalCallerPhone);
          // Re-lookup owner with the newly found phone number
          ownerInfo = await getOwnerByPhoneNumber(finalCallerPhone);
          console.log('[VAPI WEBHOOK] Owner re-lookup result:', {
            found: !!ownerInfo,
            ownerName: ownerInfo?.fullName,
            ownerAgentId: ownerInfo?.agentId,
          });
        }
      }
      
      // Verify caller is owner
      // If getOwnerByPhoneNumber found a match, the caller IS the owner (we matched by phone number)
      // Additionally verify agentId matches if it's set in Airtable (for extra security)
      if (!ownerInfo) {
        console.error('[VAPI WEBHOOK] make_outbound_call REJECTED: Owner not found', {
          callerPhone: finalCallerPhone || '(NOT FOUND)',
          assistantId: assistantId || '(NOT FOUND)',
          payloadStructure: {
            hasCustomer: !!payload.customer,
            hasCall: !!payload.call,
            hasMessage: !!payload.message,
            customerNumber: payload.customer?.number,
            callCustomerNumber: payload.call?.customer?.number,
            messageCallCustomerNumber: payload.message?.call?.customer?.number,
          },
        });
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'I can only make calls when requested by the owner of this number. Regular callers cannot request outbound calls.',
            }
          ]
        });
      }
      
      // If agentId is set in Airtable, verify it matches the assistantId
      // If agentId is not set, we trust the phone number match (ownerInfo was found by phone number)
      // IMPORTANT: If agentId is empty string, null, or undefined, treat it as "not set"
      const agentIdIsSet = ownerInfo.agentId && 
                          ownerInfo.agentId !== '' && 
                          ownerInfo.agentId !== null && 
                          ownerInfo.agentId !== undefined;
      
      const isOwnerMatch = agentIdIsSet
        ? ownerInfo.agentId === assistantId 
        : true; // Phone number match is sufficient if agentId not set
      
      console.log('[VAPI WEBHOOK] Owner verification check:', {
        ownerName: ownerInfo.fullName,
        ownerPhone: ownerInfo.mobileNumber,
        callerPhone: finalCallerPhone,
        ownerAgentId: ownerInfo.agentId,
        assistantId: assistantId,
        agentIdIsSet: agentIdIsSet,
        agentIdMatches: agentIdIsSet ? (ownerInfo.agentId === assistantId) : 'N/A',
        phoneMatch: true, // We found ownerInfo, so phone matches
        finalVerification: isOwnerMatch,
      });
      
      if (!isOwnerMatch) {
        console.error('[VAPI WEBHOOK] make_outbound_call REJECTED: AgentId mismatch', {
          callerPhone: finalCallerPhone,
          assistantId,
          ownerAgentId: ownerInfo.agentId,
          ownerName: ownerInfo.fullName,
          isOwner: false,
          reason: 'agentId mismatch - owner agentId does not match assistantId',
        });
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'I can only make calls when requested by the owner of this number. Regular callers cannot request outbound calls.',
            }
          ]
        });
      }
      
      console.log('[VAPI WEBHOOK] Owner verification PASSED - proceeding with outbound call');
      
      const phoneNumber = args.phone_number;
      const message = args.message;
      const callerName = args.caller_name || ownerInfo.fullName;
      const scheduledTime = args.scheduled_time;
      
      console.log('[VAPI WEBHOOK] make_outbound_call parameters:', {
        phoneNumber,
        message: message ? message.substring(0, 50) + '...' : null,
        callerName,
        scheduledTime,
        hasPhoneNumber: !!phoneNumber,
        hasMessage: !!message,
      });
      
      if (!phoneNumber || !message) {
        console.error('[VAPI WEBHOOK] make_outbound_call missing required parameters:', {
          hasPhoneNumber: !!phoneNumber,
          hasMessage: !!message,
          args,
        });
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error: phone_number and message are required',
            }
          ]
        });
      }
      
      // Format phone number to E.164
      const formatPhoneNumberToE164 = (phone: string): string | null => {
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
      };
      
      const formattedPhone = formatPhoneNumberToE164(phoneNumber);
      if (!formattedPhone) {
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error: Invalid phone number format',
            }
          ]
        });
      }
      
      // Always schedule calls for 3 seconds after call ends (instead of making them immediate)
      // Calculate time 3 seconds in the future
      let scheduledTimeISO: string | null = null;
      
      // If explicit scheduled_time is provided, try to parse it
      if (scheduledTime) {
        scheduledTimeISO = parseTimeExpression(scheduledTime);
        // If parsing failed, fall back to 3 seconds default
        if (!scheduledTimeISO) {
          console.warn('[VAPI WEBHOOK] Failed to parse scheduled_time, using default 3 seconds');
          const futureTime = new Date(Date.now() + 3 * 1000);
          scheduledTimeISO = futureTime.toISOString();
        }
      } else {
        // Otherwise, always schedule for 3 seconds after call ends
        const futureTime = new Date(Date.now() + 3 * 1000);
        scheduledTimeISO = futureTime.toISOString();
        console.log('[VAPI WEBHOOK] Scheduling call for 3 seconds after call ends:', scheduledTimeISO);
      }
      
      // Ensure we have a valid scheduled time (should always be set at this point)
      if (!scheduledTimeISO) {
        // Fallback: 3 seconds in future
        const futureTime = new Date(Date.now() + 3 * 1000);
        scheduledTimeISO = futureTime.toISOString();
      }
      
      // Validate scheduled time is in the future (compare ISO dates directly)
      const scheduledDate = new Date(scheduledTimeISO);
      const now = new Date();
      if (scheduledDate > now) {
        // Schedule the call
        try {
          const task = await createScheduledCallTask({
            phone_number: formattedPhone,
            message: message || '',
            scheduled_time: scheduledTimeISO,
            owner_agent_id: assistantId,
            caller_name: callerName,
            phone_number_id: phoneNumberId || undefined,
            status: 'pending',
          });
          
          if (!task) {
            console.error('[VAPI WEBHOOK] Failed to create scheduled call task (table not configured)');
            return NextResponse.json({
              results: [
                {
                  toolCallId: toolCallId,
                  result: 'Error: Scheduled calls are not configured. Please contact support.',
                }
              ]
            });
          }
          
          const resultText = `I'll make sure I call after we hang up.`;
          const response = {
            results: [
              {
                toolCallId: toolCallId,
                result: resultText,
              }
            ]
          };
          
          console.log('[VAPI WEBHOOK] ===== SENDING make_outbound_call RESPONSE =====');
          console.log('[VAPI WEBHOOK] Response format: VAPI results array');
          console.log('[VAPI WEBHOOK] ToolCallId:', toolCallId);
          console.log('[VAPI WEBHOOK] Response:', resultText);
          console.log('[VAPI WEBHOOK] Full response object:', JSON.stringify(response, null, 2));
          
          return NextResponse.json(response);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[VAPI WEBHOOK] Error scheduling call:', error);
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: `Error scheduling call: ${errorMessage}. Please try again.`,
              }
            ]
          });
        }
      } else {
        // If scheduled time is invalid, default to 3 seconds in future
        const fallbackTime = new Date(Date.now() + 3 * 1000);
        const fallbackScheduledTimeISO = fallbackTime.toISOString();
        console.warn('[VAPI WEBHOOK] Scheduled time was invalid, using fallback 3 seconds:', fallbackScheduledTimeISO);
        
        try {
          const task = await createScheduledCallTask({
            phone_number: formattedPhone,
            message: message || '',
            scheduled_time: fallbackScheduledTimeISO,
            owner_agent_id: assistantId,
            caller_name: callerName,
            status: 'pending',
          });
          
          if (!task) {
            console.error('[VAPI WEBHOOK] Failed to create scheduled call task (table not configured)');
            return NextResponse.json({
              results: [
                {
                  toolCallId: toolCallId,
                  result: 'Error: Scheduled calls are not configured. Please contact support.',
                }
              ]
            });
          }
          
          const resultText = `I'll make the call after we end this call.`;
          const response = {
            results: [
              {
                toolCallId: toolCallId,
                result: resultText,
              }
            ]
          };
          
          console.log('[VAPI WEBHOOK] ===== SENDING make_outbound_call RESPONSE (fallback) =====');
          console.log('[VAPI WEBHOOK] Response format: VAPI results array');
          console.log('[VAPI WEBHOOK] ToolCallId:', toolCallId);
          console.log('[VAPI WEBHOOK] Response:', resultText);
          
          return NextResponse.json(response);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[VAPI WEBHOOK] Error scheduling call (fallback):', error);
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: `Error scheduling call: ${errorMessage}. Please try again.`,
              }
            ]
          });
        }
      }
      
      // Immediate call path - KEPT FOR NOW, will remove after testing confirms scheduling works
      // This code is currently unreachable because all calls are scheduled above
      if (false) {
        // Make immediate call via VAPI API
        try {
          const VAPI_API_URL = 'https://api.vapi.ai';
          const apiKey = process.env.VAPI_PRIVATE_KEY;
          
          if (!apiKey) {
            console.error('[VAPI WEBHOOK] VAPI_PRIVATE_KEY not configured');
            return NextResponse.json({
              results: [
                {
                  toolCallId: toolCallId,
                  result: 'Error: VAPI API key is not configured. Please contact support to fix this issue.',
                }
              ]
            });
          }
          
          // Validate phone number format before making call (this path is unreachable but kept for reference)
          // Type assertion: we already validated formattedPhone earlier and returned if null
          const validatedPhone = formattedPhone!;
          if (!validatedPhone.startsWith('+') || validatedPhone.length < 11) {
            console.error('[VAPI WEBHOOK] Invalid phone number format:', validatedPhone);
            return NextResponse.json({
              results: [
                {
                  toolCallId: toolCallId,
                  result: `Error: Invalid phone number format "${phoneNumber || 'unknown'}". Please provide a valid phone number.`,
                }
              ]
            });
          }
          
          const callPayload = {
            customer: {
              number: validatedPhone,
            },
            assistantId: assistantId,
            metadata: {
              message: message,
              callerName: callerName || 'the owner',
            },
          };
          
          console.log('[VAPI WEBHOOK] Making outbound call with payload:', JSON.stringify(callPayload, null, 2));
          
          const callResponse = await fetch(`${VAPI_API_URL}/call`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(callPayload),
          });
          
          console.log('[VAPI WEBHOOK] Call response status:', callResponse.status, callResponse.statusText);
          
          if (!callResponse.ok) {
            const errorData = await callResponse.json().catch(() => ({}));
            console.error('[VAPI WEBHOOK] Call failed with error:', JSON.stringify(errorData, null, 2));
            
            // Provide specific error messages
            let errorMessage = 'Failed to make call';
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (callResponse.status === 401) {
              errorMessage = 'Authentication failed. Please contact support.';
            } else if (callResponse.status === 400) {
              errorMessage = 'Invalid request. Please check the phone number and try again.';
            } else if (callResponse.status === 429) {
              errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
            } else if (callResponse.status >= 500) {
              errorMessage = 'VAPI service is temporarily unavailable. Please try again later.';
            }
            
            return NextResponse.json({
              results: [
                {
                  toolCallId: toolCallId,
                  result: `Error: ${errorMessage}. Please try again or contact support if the issue persists.`,
                }
              ]
            });
          }
          
          const callResult = await callResponse.json();
          const callId = callResult.id || callResult.callId || '';
          
          console.log('[VAPI WEBHOOK] Call initiated successfully:', {
            callId,
            phoneNumber: validatedPhone,
            assistantId,
            message: message.substring(0, 50) + '...',
          });
          
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: `Call initiated successfully to ${validatedPhone}. The call is now in progress.`,
              }
            ]
          });
        } catch (err: unknown) {
          let errorMessage = 'Unknown error';
          let errorStack: string | undefined = undefined;
          if (err instanceof Error) {
            const error = err as Error;
            errorMessage = error.message;
            errorStack = error.stack;
          } else if (typeof err === 'string') {
            errorMessage = err as string;
          } else {
            errorMessage = String(err);
          }
          console.error('[VAPI WEBHOOK] Error making outbound call:', {
            error: errorMessage,
            stack: errorStack,
            phoneNumber: formattedPhone,
            assistantId,
            message,
          });
          
          // Provide user-friendly error message
          let friendlyErrorMessage = 'Unknown error occurred';
          if (errorMessage.includes('fetch')) {
            friendlyErrorMessage = 'Network error. Please check your connection and try again.';
          } else {
            friendlyErrorMessage = errorMessage;
          }
          
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: `Error making call: ${friendlyErrorMessage}. Please try again or contact support if the issue persists.`,
              }
            ]
          });
        }
      }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('[VAPI WEBHOOK] Error in make_outbound_call handler:', {
          error: errorMessage,
          stack: errorStack,
          toolCallId: toolCallId || '(NOT FOUND)',
        });
        
        // Return error in VAPI format
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId || '',
              result: `Error making outbound call: ${errorMessage}. Please try again or contact support if the issue persists.`,
            }
          ]
        });
      }
    }
    
    // Handle schedule_outbound_call function
    if (functionName === 'schedule_outbound_call') {
      // Extract toolCallId from functionCall - VAPI requires this in the response
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      console.log('[VAPI WEBHOOK] ===== schedule_outbound_call FUNCTION CALLED =====');
      console.log('[VAPI WEBHOOK] Function detection successful, entering handler');
      console.log('[VAPI WEBHOOK] Extracted toolCallId:', toolCallId || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Function args:', JSON.stringify(args, null, 2));
      console.log('[VAPI WEBHOOK] Caller phone number:', callerPhoneNumber || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Assistant ID:', assistantId || '(NOT FOUND)');
      console.log('[VAPI WEBHOOK] Owner info found:', !!ownerInfo);
      
      // CRITICAL: If we don't have a caller phone number, try to extract it from the payload again
      let finalCallerPhone = callerPhoneNumber;
      if (!finalCallerPhone) {
        console.warn('[VAPI WEBHOOK] Caller phone not found in initial extraction, trying alternative extraction...');
        finalCallerPhone = 
          payload.from?.number ||
          payload.from?.phone ||
          payload.phoneNumber?.number ||
          payload.phone?.number ||
          '';
        if (finalCallerPhone) {
          console.log('[VAPI WEBHOOK] Found caller phone via alternative extraction:', finalCallerPhone);
          ownerInfo = await getOwnerByPhoneNumber(finalCallerPhone);
          console.log('[VAPI WEBHOOK] Owner re-lookup result:', {
            found: !!ownerInfo,
            ownerName: ownerInfo?.fullName,
            ownerAgentId: ownerInfo?.agentId,
          });
        }
      }
      
      // Verify caller is owner
      if (!ownerInfo) {
        console.error('[VAPI WEBHOOK] schedule_outbound_call REJECTED: Owner not found', {
          callerPhone: finalCallerPhone || '(NOT FOUND)',
          assistantId: assistantId || '(NOT FOUND)',
        });
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'I can only schedule calls when requested by the owner of this number. Regular callers cannot request outbound calls.',
            }
          ]
        });
      }
      
      // If agentId is set in Airtable, verify it matches the assistantId
      // If agentId is not set, we trust the phone number match (ownerInfo was found by phone number)
      // IMPORTANT: If agentId is empty string, null, or undefined, treat it as "not set"
      const agentIdIsSet = ownerInfo.agentId && 
                          ownerInfo.agentId !== '' && 
                          ownerInfo.agentId !== null && 
                          ownerInfo.agentId !== undefined;
      
      const isOwnerMatch = agentIdIsSet
        ? ownerInfo.agentId === assistantId 
        : true; // Phone number match is sufficient if agentId not set
      
      console.log('[VAPI WEBHOOK] Owner verification check:', {
        ownerName: ownerInfo.fullName,
        ownerPhone: ownerInfo.mobileNumber,
        callerPhone: finalCallerPhone,
        ownerAgentId: ownerInfo.agentId,
        assistantId: assistantId,
        agentIdIsSet: agentIdIsSet,
        agentIdMatches: agentIdIsSet ? (ownerInfo.agentId === assistantId) : 'N/A',
        phoneMatch: true,
        finalVerification: isOwnerMatch,
      });
      
      if (!isOwnerMatch) {
        console.error('[VAPI WEBHOOK] schedule_outbound_call REJECTED: AgentId mismatch', {
          callerPhone: finalCallerPhone,
          assistantId,
          ownerAgentId: ownerInfo.agentId,
          ownerName: ownerInfo.fullName,
          isOwner: false,
          reason: 'agentId mismatch - owner agentId does not match assistantId',
        });
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'I can only schedule calls when requested by the owner of this number. Regular callers cannot request outbound calls.',
            }
          ]
        });
      }
      
      console.log('[VAPI WEBHOOK] Owner verification PASSED - proceeding with scheduled call');
      
      const phoneNumber = args.phone_number as string | undefined;
      const message = args.message as string | undefined;
      const scheduledTime = args.scheduled_time as string | undefined;
      const callerName = (args.caller_name as string | undefined) || ownerInfo.fullName;
      
      if (!phoneNumber || !message || !scheduledTime) {
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error: phone_number, message, and scheduled_time are required',
            }
          ]
        });
      }
      
      // Format phone number to E.164
      const formatPhoneNumberToE164 = (phone: string): string | null => {
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
      };
      
      const formattedPhone = formatPhoneNumberToE164(phoneNumber);
      if (!formattedPhone) {
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Error: Invalid phone number format',
            }
          ]
        });
      }
      
      // ALWAYS schedule for 3 seconds after the call ends (regardless of what scheduled_time was provided)
      // Since we're in a call, schedule for 3 seconds from now (call will end, then 3 seconds later, make the call)
      const now = new Date();
      const scheduledTimeISO = new Date(now.getTime() + 3 * 1000).toISOString();
      console.log('[VAPI WEBHOOK] Scheduling call for 3 seconds after call ends:', scheduledTimeISO);
      
      // Schedule the call
      try {
        const task = await createScheduledCallTask({
          phone_number: formattedPhone,
          message: message,
          scheduled_time: scheduledTimeISO,
          owner_agent_id: assistantId,
          caller_name: callerName,
          status: 'pending',
        });
        
        if (!task) {
          console.error('[VAPI WEBHOOK] Failed to create scheduled call task (table not configured)');
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: 'Error: Scheduled calls are not configured. Please contact support.',
              }
            ]
          });
        }
        
        const resultText = `I'll make sure I call after we hang up.`;
        const response = {
          results: [
            {
              toolCallId: toolCallId,
              result: resultText,
            }
          ]
        };
        
        console.log('[VAPI WEBHOOK] ===== SENDING schedule_outbound_call RESPONSE =====');
        console.log('[VAPI WEBHOOK] Response format: VAPI results array');
        console.log('[VAPI WEBHOOK] ToolCallId:', toolCallId);
        console.log('[VAPI WEBHOOK] Response:', resultText);
        console.log('[VAPI WEBHOOK] Full response object:', JSON.stringify(response, null, 2));
        
        return NextResponse.json(response);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[VAPI WEBHOOK] Error scheduling call:', error);
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: `Error scheduling call: ${errorMessage}. Please try again.`,
            }
          ]
        });
      }
    }
    
    // Handle capture_note function (if it comes through here)
    if (functionName === 'capture_note') {
      // Extract toolCallId for proper response format
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      // This is typically handled in end-of-call processing, but handle it here if needed
      console.log('[VAPI WEBHOOK] capture_note called in real-time (unusual)');
      return NextResponse.json({
        results: [
          {
            toolCallId: toolCallId,
            result: 'Note captured. It will be processed at the end of the call.',
          }
        ]
      });
    }
    
    // Handle get_user_context function
    if (functionName === 'get_user_context') {
      const toolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      const functionStartTime = Date.now();
      if (callMetrics) {
        callMetrics.toolRecalls++;
      }
      
      try {
        const topic = args.topic as string | undefined;
        
        // Get user record to find recordId
        const userRecord = await getUserRecord(assistantId);
        if (!userRecord || !userRecord.id) {
          if (callMetrics) {
            callMetrics.functionFailures++;
            callMetrics.toolCalls.push({
              name: 'get_user_context',
              latency: Date.now() - functionStartTime,
              success: false,
            });
          }
          return NextResponse.json({
            results: [
              {
                toolCallId: toolCallId,
                result: 'Sorry, one moment — let me check that again.',
                error: true,
              }
            ]
          });
        }
        
        const timeout = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const context = await Promise.race([
          getUserContext(userRecord.id, topic),
          timeout
        ]);
        
        if (callMetrics) {
          callMetrics.toolCalls.push({
            name: 'get_user_context',
            latency: Date.now() - functionStartTime,
            success: true,
          });
        }
        
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: context,
            }
          ]
        });
      } catch (error) {
        console.error('[VAPI WEBHOOK] Error in get_user_context:', error);
        if (callMetrics) {
          callMetrics.functionFailures++;
          callMetrics.toolCalls.push({
            name: 'get_user_context',
            latency: Date.now() - functionStartTime,
            success: false,
          });
        }
        return NextResponse.json({
          results: [
            {
              toolCallId: toolCallId,
              result: 'Sorry, one moment — let me check that again.',
              error: true,
            }
          ]
        });
      }
    }
    
    // Handle get_user_contacts function
    if (functionName === 'get_user_contacts') {
      const contactsToolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      const functionStartTime = Date.now();
      if (callMetrics) {
        callMetrics.toolRecalls++;
      }
      
      try {
        const contactName = args.contactName as string | undefined;
        
        // Get user record to find recordId
        const userRecord = await getUserRecord(assistantId);
        if (!userRecord || !userRecord.id) {
          if (callMetrics) {
            callMetrics.functionFailures++;
            callMetrics.toolCalls.push({
              name: 'get_user_contacts',
              latency: Date.now() - functionStartTime,
              success: false,
            });
          }
          return NextResponse.json({
            results: [
              {
                toolCallId: contactsToolCallId,
                result: 'Sorry, one moment — let me check that again.',
                error: true,
              }
            ]
          });
        }
        
        const timeout = new Promise<Array<{ name: string; phone: string; notes?: string }>>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const contacts = await Promise.race([
          getUserContacts(userRecord.id, contactName),
          timeout
        ]);
        
        // Format contacts as simple text (max 5)
        const formattedContacts = contacts.slice(0, 5).map(c => 
          `${c.name}: ${c.phone}${c.notes ? ` (${c.notes})` : ''}`
        ).join(', ');
        
        if (callMetrics) {
          callMetrics.toolCalls.push({
            name: 'get_user_contacts',
            latency: Date.now() - functionStartTime,
            success: true,
          });
        }
        
        return NextResponse.json({
          results: [
            {
              toolCallId: contactsToolCallId,
              result: formattedContacts || 'No contacts found.',
            }
          ]
        });
      } catch (error) {
        console.error('[VAPI WEBHOOK] Error in get_user_contacts:', error);
        if (callMetrics) {
          callMetrics.functionFailures++;
          callMetrics.toolCalls.push({
            name: 'get_user_contacts',
            latency: Date.now() - functionStartTime,
            success: false,
          });
        }
        return NextResponse.json({
          results: [
            {
              toolCallId: contactsToolCallId,
              result: 'Sorry, one moment — let me check that again.',
              error: true,
            }
          ]
        });
      }
    }
    
    // Handle get_user_documents function
    if (functionName === 'get_user_documents') {
      const documentsToolCallId = functionCall?.id || 
                         functionCall?.toolCallId || 
                         payload.toolCallId ||
                         '';
      
      const functionStartTime = Date.now();
      if (callMetrics) {
        callMetrics.toolRecalls++;
      }
      
      try {
        const query = args.query as string | undefined;
        
        // Get user record to find recordId
        const userRecord = await getUserRecord(assistantId);
        if (!userRecord || !userRecord.id) {
          if (callMetrics) {
            callMetrics.functionFailures++;
            callMetrics.toolCalls.push({
              name: 'get_user_documents',
              latency: Date.now() - functionStartTime,
              success: false,
            });
          }
          return NextResponse.json({
            results: [
              {
                toolCallId: documentsToolCallId,
                result: 'Sorry, one moment — let me check that again.',
                error: true,
              }
            ]
          });
        }
        
        const timeout = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const documents = await Promise.race([
          getUserDocuments(userRecord.id, query),
          timeout
        ]);
        
        if (callMetrics) {
          callMetrics.toolCalls.push({
            name: 'get_user_documents',
            latency: Date.now() - functionStartTime,
            success: true,
          });
        }
        
        return NextResponse.json({
          results: [
            {
              toolCallId: documentsToolCallId,
              result: documents || 'No documents found.',
            }
          ]
        });
      } catch (error) {
        console.error('[VAPI WEBHOOK] Error in get_user_documents:', error);
        if (callMetrics) {
          callMetrics.functionFailures++;
          callMetrics.toolCalls.push({
            name: 'get_user_documents',
            latency: Date.now() - functionStartTime,
            success: false,
          });
        }
        return NextResponse.json({
          results: [
            {
              toolCallId: documentsToolCallId,
              result: 'Sorry, one moment — let me check that again.',
              error: true,
            }
          ]
        });
      }
    }
    
    // Unknown function - return success but no result
    // Extract toolCallId for proper response format
    const unknownToolCallId = functionCall?.id || 
                       functionCall?.toolCallId || 
                       payload.toolCallId ||
                       '';
    
    console.log('[VAPI WEBHOOK] Unknown function:', functionName);
    return NextResponse.json({ 
      results: [
        {
          toolCallId: unknownToolCallId,
          result: `I don't know how to handle the function "${functionName}". Please check the function name.`,
        }
      ]
    });
  } catch (error) {
    // Extract toolCallId for proper error response format
    const errorToolCallId = payload?.functionCall?.id || 
                       payload?.functionCall?.toolCallId || 
                       payload?.toolCallId ||
                       payload?.message?.artifact?.messages?.find((m: any) => m.toolCalls)?.[0]?.id ||
                       '';
    
    console.error('[VAPI WEBHOOK] Error handling function call event:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      payload: JSON.stringify(payload, null, 2).substring(0, 500), // First 500 chars
      toolCallId: errorToolCallId || '(NOT FOUND)',
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      results: [
        {
          toolCallId: errorToolCallId,
          result: `I encountered an error: ${errorMessage}. Please try again or contact support.`,
        }
      ]
    });
  }
}

/**
 * VAPI Webhook Handler
 * Handles assistant.result events from VAPI
 * Processes capture_note function calls and sends SMS to owners
 */
export async function POST(request: NextRequest) {
  // Start background executor on first webhook call (Next.js lazy-loads routes)
  ensureBackgroundExecutorStarted();
  
  // CRITICAL: Log immediately when handler is called (before any processing)
  const requestStartTime = Date.now();
  const requestUrl = request.url;
  const requestMethod = request.method;
  const requestHeaders = Object.fromEntries(request.headers.entries());
  
  // Initialize call metrics tracking
  const callMetrics: {
    startTime: number;
    firstTokenTime: number | null;
    toolCalls: Array<{ name: string; latency: number; success: boolean }>;
    toolRecalls: number;
    droppedResponses: number;
    functionFailures: number;
    assistantId?: string;
    callId?: string;
  } = {
    startTime: requestStartTime,
    firstTokenTime: null,
    toolCalls: [],
    toolRecalls: 0,
    droppedResponses: 0,
    functionFailures: 0,
  };
  
  console.log('[VAPI WEBHOOK] ===== POST HANDLER CALLED =====');
  console.log('[VAPI WEBHOOK] Timestamp:', new Date().toISOString());
  console.log('[VAPI WEBHOOK] Request URL:', requestUrl);
  console.log('[VAPI WEBHOOK] Request Method:', requestMethod);
  console.log('[VAPI WEBHOOK] Request Headers:', JSON.stringify(requestHeaders, null, 2));
  
  // Error boundary: Catch ANY errors at the top level
  // Store payload outside try block so it's accessible in error handler
  let payload: any = null;
  let rawBody: string = '';
  
  try {
    // Read raw body as text first (before parsing)
    rawBody = await request.text();
    console.log('[VAPI WEBHOOK] Raw request body length:', rawBody.length);
    console.log('[VAPI WEBHOOK] Raw request body (first 1000 chars):', rawBody.substring(0, 1000));
    
    // Parse webhook payload
    try {
      payload = JSON.parse(rawBody);
      console.log('[VAPI WEBHOOK] JSON parsing successful');
    } catch (parseError) {
      console.error('[VAPI WEBHOOK] JSON parsing failed:', parseError);
      console.error('[VAPI WEBHOOK] Raw body that failed to parse:', rawBody);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON payload',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        },
        { status: 400 }
      );
    }
    
    console.log('[VAPI WEBHOOK] ===== NEW WEBHOOK REQUEST (PARSED) =====');
    console.log('[VAPI WEBHOOK] Full payload received:', JSON.stringify(payload, null, 2));
    
    // Check for different possible event types
    const eventType = payload.type || payload.event || payload.message?.type || payload.status;
    console.log('[VAPI WEBHOOK] Event type detected:', eventType);
    
    // Check if this is an SMS event
    const isSMSEvent = 
      eventType === 'sms' ||
      eventType === 'message' ||
      payload.messageType === 'sms' ||
      payload.channel === 'sms' ||
      payload.type === 'message.received' ||
      (payload.message && payload.message.type === 'sms') ||
      (payload.body && payload.from && payload.to); // Twilio SMS webhook format
    
    if (isSMSEvent) {
      console.log('[VAPI WEBHOOK] SMS event detected, processing SMS...');
      return await handleSMSEvent(payload, request);
    }
    
    // ===== CRITICAL: CHECK FOR FUNCTION CALLS FIRST (before Phase 1) =====
    // Function calls can appear in speech-update events with status "ringing"
    // We MUST process function calls BEFORE Phase 1 logging, otherwise they get blocked
    const hasFunctionCall = 
      eventType === 'function-call' ||
      eventType === 'function.call' ||
      eventType === 'function-call-request' ||
      payload.functionCall ||
      payload.function_call ||
      payload.functionName ||
      // Check for toolCalls in messages (real-time function calls) - check ALL possible locations
      (payload.messages && Array.isArray(payload.messages) && payload.messages.some((msg: any) => 
        msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0
      )) ||
      // CRITICAL: Check nested message structures (speech-update events have this)
      (payload.message?.messages && Array.isArray(payload.message.messages) && payload.message.messages.some((msg: any) => 
        msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0
      )) ||
      // CRITICAL: Check artifact messages (speech-update events also have this)
      (payload.message?.artifact?.messages && Array.isArray(payload.message.artifact.messages) && payload.message.artifact.messages.some((msg: any) => 
        msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0
      )) ||
      // Check for function in the payload directly (alternative VAPI format)
      (payload.function && payload.function.name);
    
    // If there's a function call, skip Phase 1 and let the function call handler process it
    if (hasFunctionCall) {
      console.log('[VAPI WEBHOOK] ⚠️  Function call detected - skipping Phase 1 logging to process function call');
    }
    
    // ===== PHASE 1: CALL-START WEBHOOK DETECTION (LOGGING ONLY) =====
    // Detect call-start events to see if we can pre-identify the owner
    // BUT: Skip Phase 1 if this event contains a function call (function calls take priority)
    const callStatus = payload.status || payload.call?.status || payload.message?.call?.status;
    const isCallStartEvent = 
      !hasFunctionCall && (  // CRITICAL: Skip if function call exists
        eventType === 'status-update' ||
        eventType === 'call-start' ||
        eventType === 'call.started' ||
        eventType === 'phone-call-status-update' ||
        (callStatus && (callStatus === 'ringing' || callStatus === 'in-progress' || callStatus === 'queued')) ||
        payload.type === 'phone-call-status-update'
      );
    
    if (isCallStartEvent) {
      console.log('[PHASE 1 - CALL START] ===== CALL-START WEBHOOK DETECTED =====');
      console.log('[PHASE 1 - CALL START] Event type:', eventType);
      console.log('[PHASE 1 - CALL START] Call status:', callStatus);
      console.log('[PHASE 1 - CALL START] Timestamp:', new Date().toISOString());
      console.log('[PHASE 1 - CALL START] Full payload:', JSON.stringify(payload, null, 2));
      
      // Extract caller phone number from multiple possible locations
      const callerPhoneNumber = 
        payload.customer?.number || 
        payload.customer?.phone || 
        payload.call?.customer?.number ||
        payload.message?.call?.customer?.number ||
        payload.message?.customer?.number ||
        payload.caller?.number ||
        payload.caller?.phone ||
        payload.from?.phone ||
        payload.from?.number ||
        '';
      
      console.log('[PHASE 1 - CALL START] Caller phone number:', callerPhoneNumber || '(NOT FOUND)');
      
      // Extract call ID
      const callId = 
        payload.call?.id ||
        payload.message?.call?.id ||
        payload.callId ||
        payload.id ||
        '';
      
      console.log('[PHASE 1 - CALL START] Call ID:', callId || '(NOT FOUND)');
      
      // Extract assistant ID
      const assistantId = 
        payload.assistant?.id ||
        payload.call?.assistantId ||
        payload.message?.call?.assistantId ||
        payload.assistantId ||
        '';
      
      console.log('[PHASE 1 - CALL START] Assistant ID:', assistantId || '(NOT FOUND)');
      
      // Update call metrics with assistantId and callId
      if (assistantId) callMetrics.assistantId = assistantId;
      if (callId) callMetrics.callId = callId;
      
      // Try to check if caller is owner (just for logging, don't set variables yet)
      let ownerInfo: any = null;
      let isOwner = false;
      
      if (callerPhoneNumber) {
        try {
          ownerInfo = await getOwnerByPhoneNumber(callerPhoneNumber);
          if (ownerInfo) {
            isOwner = true;
            console.log('[PHASE 1 - CALL START] ✅ OWNER IDENTIFIED:', {
              fullName: ownerInfo.fullName,
              phoneNumber: callerPhoneNumber,
              agentId: ownerInfo.agentId,
            });
            console.log('[PHASE 1 - CALL START] ⚠️  If we could set variables, we would set:');
            console.log('[PHASE 1 - CALL START]    - variableValues.isOwner = true');
            console.log('[PHASE 1 - CALL START]    - variableValues.ownerName =', ownerInfo.fullName);
          } else {
            console.log('[PHASE 1 - CALL START] ℹ️  Caller is NOT the owner (regular caller)');
          }
        } catch (error) {
          console.error('[PHASE 1 - CALL START] ❌ Error checking owner:', error);
        }
      } else {
        console.log('[PHASE 1 - CALL START] ⚠️  Could not extract caller phone number - cannot check owner');
      }
      
      // Log timing information (if available)
      const callCreatedAt = 
        payload.call?.createdAt ||
        payload.message?.call?.createdAt ||
        payload.createdAt ||
        '';
      
      if (callCreatedAt) {
        const callStartTime = new Date(callCreatedAt).getTime();
        const webhookArrivalTime = Date.now();
        const delayMs = webhookArrivalTime - callStartTime;
        console.log('[PHASE 1 - CALL START] Timing analysis:');
        console.log('[PHASE 1 - CALL START]    - Call created at:', callCreatedAt);
        console.log('[PHASE 1 - CALL START]    - Webhook arrived at:', new Date().toISOString());
        console.log('[PHASE 1 - CALL START]    - Delay:', delayMs, 'ms');
      }
      
      // Return success but don't interfere with call processing
      console.log('[PHASE 1 - CALL START] ===== END CALL-START WEBHOOK LOGGING =====');
      return NextResponse.json({ 
        success: true, 
        message: 'Call-start webhook logged (Phase 1 - logging only)',
        phase1: true,
        callerIsOwner: callerPhoneNumber ? isOwner : null,
        callerPhoneNumber: callerPhoneNumber || null,
      });
    }
    
    // VAPI might send different event types. We need to handle:
    // - "assistant.result" (end of call with summary)
    // - "function-call" (when function is called during call)
    // - "status-update" (call status changes)
    // - "end-of-call-report" (alternative name)
    // - "call-end" or similar
    // - Real-time function calls may come without a specific event type, just with toolCalls in messages
    
    // NOTE: hasFunctionCall is already checked earlier (before Phase 1) to prevent blocking function calls
    // We check it again here for more detailed detection (specific function names)
    // Log detection attempt for debugging
    if (hasFunctionCall) {
      console.log('[VAPI WEBHOOK] Function call detected! Event type:', eventType);
    }
    
    // Check if this is an end-of-call event (where we get function calls)
    // Also check for messages array which indicates end-of-call event with transcript
    const hasMessagesArray = !!(payload.messages || payload.message?.messages || payload.message?.artifact?.messages);
    const isEndOfCallEvent = 
      eventType === 'assistant.result' ||
      eventType === 'end-of-call-report' ||
      eventType === 'end-of-call' ||
      eventType === 'call-end' ||
      payload.status === 'ended' ||
      payload.call?.status === 'ended' ||
      payload.state === 'ended' ||
      // If payload has messages array with transcript data, it's likely an end-of-call event
      (hasMessagesArray && (payload.transcript || payload.message?.transcript || payload.summary || payload.message?.summary));
    
    console.log('[VAPI WEBHOOK] End-of-call event detection:', {
      eventType,
      status: payload.status,
      callStatus: payload.call?.status,
      hasMessagesArray,
      hasTranscript: !!(payload.transcript || payload.message?.transcript),
      isEndOfCallEvent,
    });
    
    // CRITICAL: Check if this is an end-of-call event FIRST (before real-time function calls)
    // End-of-call events can contain function calls, but should be processed differently
    if (isEndOfCallEvent) {
      console.log('[VAPI WEBHOOK] Detected end-of-call event, processing (may contain function calls)');
      // Continue to end-of-call processing below - don't return early
      // This allows us to process function calls from end-of-call events
    } else if (hasFunctionCall) {
      // Handle real-time function-call events (NOT end-of-call events)
      console.log('[VAPI WEBHOOK] Detected real-time function call event, routing to handleFunctionCallEvent');
      return await handleFunctionCallEvent(payload, request, callMetrics);
    } else {
      console.log('[VAPI WEBHOOK] Not an end-of-call or function-call event, ignoring. Event type:', eventType);
      return NextResponse.json({ success: true, message: 'Event type not handled' });
    }
    
    // Continue with end-of-call event processing (even if it contains function calls)

    // Extract required data from payload - try multiple possible structures
    // Check if payload is nested in a 'message' field
    const actualPayload = payload.message || payload;
    
    let assistantId = 
      actualPayload.assistant?.id || 
      payload.assistant?.id || 
      payload.assistantId || 
      payload.assistant_id ||
      '';
    
    // Update call metrics
    if (assistantId) callMetrics.assistantId = assistantId;
    const endCallId = actualPayload.call?.id || payload.call?.id || payload.callId || payload.id || '';
    if (endCallId) callMetrics.callId = endCallId;
    
    // Fallback routing: If assistantId is missing, try to lookup by phone number
    if (!assistantId) {
      console.log('[VAPI WEBHOOK] AssistantId missing, attempting fallback routing by phone number');
      
      // Extract phone number from payload (the "To" number - the Canadian number)
      const phoneNumber = 
        actualPayload.phoneNumber?.number ||
        payload.phoneNumber?.number ||
        actualPayload.phoneNumber ||
        payload.phoneNumber ||
        '';
      
      if (phoneNumber) {
        console.log('[VAPI WEBHOOK] Looking up agent by Canadian number:', phoneNumber);
        const agentInfo = await getAgentByCanadianNumber(phoneNumber);
        
        if (agentInfo) {
          assistantId = agentInfo.agentId;
          console.log('[VAPI WEBHOOK] Fallback routing successful - found agent:', {
            agentId: assistantId,
            fullName: agentInfo.fullName,
            phoneNumber: phoneNumber,
          });
        } else {
          console.warn('[VAPI WEBHOOK] Fallback routing failed - no agent found for number:', phoneNumber);
        }
      } else {
        console.warn('[VAPI WEBHOOK] Fallback routing failed - no phone number in payload');
      }
    }
    
    const assistantSummary = 
      payload.summary || 
      payload.message?.summary ||
      payload.call?.summary ||
      actualPayload.transcript ||
      payload.transcript ||
      '';
    
    // Get assistant phone number from payload
    const assistantPhoneNumber = 
      actualPayload.phoneNumber?.number ||
      payload.phoneNumber?.number ||
      actualPayload.phoneNumber ||
      payload.phoneNumber ||
      '';
    
    // Get phone number ID from payload (for making outbound calls)
    const phoneNumberId = 
      actualPayload.phoneNumber?.id ||
      payload.phoneNumber?.id ||
      null;
    
    // Get caller phone number from payload (to replace placeholder in function calls)
    const callerPhoneNumber = 
      actualPayload.customer?.number || 
      payload.customer?.number || 
      actualPayload.customer?.phone || 
      payload.customer?.phone || 
      '';
    
    // Check if caller is the owner
    let isOwner = false;
    let ownerInfo = null;
    if (callerPhoneNumber) {
      ownerInfo = await getOwnerByPhoneNumber(callerPhoneNumber);
      if (ownerInfo && ownerInfo.agentId === assistantId) {
        isOwner = true;
        console.log('[VAPI WEBHOOK] Owner detected:', ownerInfo.fullName);
      }
    }
    
    // Debug logging for phone number extraction
    if (!assistantPhoneNumber || !callerPhoneNumber) {
      console.log('[VAPI WEBHOOK] Phone number extraction debug:', {
        'payload.phoneNumber': payload.phoneNumber,
        'payload.phoneNumber?.number': payload.phoneNumber?.number,
        'payload.customer': payload.customer,
        'payload.customer?.number': payload.customer?.number,
        'extractedAssistantPhone': assistantPhoneNumber,
        'extractedCallerPhone': callerPhoneNumber,
        'isOwner': isOwner,
      });
    }
      
    // Function calls might be in multiple locations
    // Check top-level first, then messages array, then other locations
    let functionCalls = 
      payload.functionCalls || 
      payload.function_calls || 
      payload.functions ||
      payload.message?.functionCalls ||
      payload.message?.functions ||
      payload.call?.functionCalls ||
      [];
    
    // Extract function calls from messages array (where VAPI actually stores them)
    // Check both actualPayload and payload for messages
    const messagesArray = actualPayload.messages || payload.messages || payload.message?.messages || payload.message?.artifact?.messages;
    
    console.log('[VAPI WEBHOOK] End-of-call event: Extracting function calls from messages', {
      hasActualPayloadMessages: !!actualPayload.messages,
      hasPayloadMessages: !!payload.messages,
      hasMessageMessages: !!payload.message?.messages,
      hasArtifactMessages: !!payload.message?.artifact?.messages,
      messagesArrayLength: messagesArray && Array.isArray(messagesArray) ? messagesArray.length : 0,
    });
    
    if (messagesArray && Array.isArray(messagesArray)) {
      for (const msg of messagesArray) {
        // Check for toolCalls field (this is where VAPI stores function calls)
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          console.log('[VAPI WEBHOOK] Found toolCalls in message:', {
            role: msg.role,
            toolCallsCount: msg.toolCalls.length,
            functionNames: msg.toolCalls.map((tc: any) => tc.function?.name).filter(Boolean),
          });
          for (const toolCall of msg.toolCalls) {
            const functionName = toolCall.function?.name;
            if (!functionName) continue;
            
            // Parse arguments (might be string or object)
            let args = toolCall.function.arguments;
            if (typeof args === 'string') {
              try {
                args = JSON.parse(args);
              } catch (e) {
                console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                continue;
              }
            }
            
            // Handle capture_note
            if (functionName === 'capture_note') {
              // Replace placeholder or invalid values with actual caller phone number
              if (!args.caller_phone || 
                  args.caller_phone === 'caller_phone_placeholder' || 
                  args.caller_phone === 'caller ID' ||
                  args.caller_phone === 'callerID' ||
                  args.caller_phone.toLowerCase().includes('caller') ||
                  args.caller_phone === '') {
                args.caller_phone = callerPhoneNumber;
              }
              
              functionCalls.push({
                name: 'capture_note',
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
            // Handle schedule_outbound_call and make_outbound_call
            else if (functionName === 'schedule_outbound_call' || functionName === 'make_outbound_call') {
              console.log(`[VAPI WEBHOOK] End-of-call: Extracted ${functionName} function call`, {
                toolCallId: toolCall.id,
                phoneNumber: args.phone_number,
                message: args.message ? args.message.substring(0, 50) + '...' : null,
                scheduledTime: args.scheduled_time,
              });
              functionCalls.push({
                name: functionName,
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
          }
        }
        
        // Also check for role === 'tool_calls' (alternative format)
        if (msg.role === 'tool_calls' && msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const toolCall of msg.toolCalls) {
            const functionName = toolCall.function?.name;
            if (!functionName) continue;
            
            let args = toolCall.function.arguments;
            if (typeof args === 'string') {
              try {
                args = JSON.parse(args);
              } catch (e) {
                console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                continue;
              }
            }
            
            // Handle capture_note
            if (functionName === 'capture_note') {
              // Replace placeholder or invalid values with actual caller phone number
              if (!args.caller_phone || 
                  args.caller_phone === 'caller_phone_placeholder' || 
                  args.caller_phone === 'caller ID' ||
                  args.caller_phone === 'callerID' ||
                  args.caller_phone.toLowerCase().includes('caller') ||
                  args.caller_phone === '') {
                args.caller_phone = callerPhoneNumber;
              }
              
              functionCalls.push({
                name: 'capture_note',
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
            // Handle schedule_outbound_call and make_outbound_call
            else if (functionName === 'schedule_outbound_call' || functionName === 'make_outbound_call') {
              console.log(`[VAPI WEBHOOK] End-of-call: Extracted ${functionName} function call`, {
                toolCallId: toolCall.id,
                phoneNumber: args.phone_number,
                message: args.message ? args.message.substring(0, 50) + '...' : null,
                scheduledTime: args.scheduled_time,
              });
              functionCalls.push({
                name: functionName,
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
          }
        }
        
        // Also check for OpenAI-formatted messages (messagesOpenAIFormatted)
        if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const toolCall of msg.tool_calls) {
            const functionName = toolCall.function?.name;
            if (!functionName) continue;
            
            let args = toolCall.function.arguments;
            if (typeof args === 'string') {
              try {
                args = JSON.parse(args);
              } catch (e) {
                console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                continue;
              }
            }
            
            // Handle capture_note
            if (functionName === 'capture_note') {
              // Replace placeholder or invalid values with actual caller phone number
              if (!args.caller_phone || 
                  args.caller_phone === 'caller_phone_placeholder' || 
                  args.caller_phone === 'caller ID' ||
                  args.caller_phone === 'callerID' ||
                  args.caller_phone.toLowerCase().includes('caller') ||
                  args.caller_phone === '') {
                args.caller_phone = callerPhoneNumber;
              }
              
              functionCalls.push({
                name: 'capture_note',
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
            // Handle schedule_outbound_call and make_outbound_call
            else if (functionName === 'schedule_outbound_call' || functionName === 'make_outbound_call') {
              console.log(`[VAPI WEBHOOK] End-of-call: Extracted ${functionName} function call`, {
                toolCallId: toolCall.id,
                phoneNumber: args.phone_number,
                message: args.message ? args.message.substring(0, 50) + '...' : null,
                scheduledTime: args.scheduled_time,
              });
              functionCalls.push({
                name: functionName,
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
          }
        }
      }
    }
    
    // Also check messagesOpenAIFormatted array (separate array where VAPI stores OpenAI-formatted messages)
    const messagesOpenAIFormatted = actualPayload.messagesOpenAIFormatted || payload.messagesOpenAIFormatted;
    if (messagesOpenAIFormatted && Array.isArray(messagesOpenAIFormatted)) {
      for (const msg of messagesOpenAIFormatted) {
        if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const toolCall of msg.tool_calls) {
            const functionName = toolCall.function?.name;
            if (!functionName) continue;
            
            let args = toolCall.function.arguments;
            if (typeof args === 'string') {
              try {
                args = JSON.parse(args);
              } catch (e) {
                console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                continue;
              }
            }
            
            // Handle capture_note
            if (functionName === 'capture_note') {
              // Replace placeholder or invalid values with actual caller phone number
              if (!args.caller_phone || 
                  args.caller_phone === 'caller_phone_placeholder' || 
                  args.caller_phone === 'caller ID' ||
                  args.caller_phone === 'callerID' ||
                  args.caller_phone.toLowerCase().includes('caller') ||
                  args.caller_phone === '') {
                args.caller_phone = callerPhoneNumber;
              }
              
              functionCalls.push({
                name: 'capture_note',
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
            // Handle schedule_outbound_call and make_outbound_call
            else if (functionName === 'schedule_outbound_call' || functionName === 'make_outbound_call') {
              console.log(`[VAPI WEBHOOK] End-of-call: Extracted ${functionName} function call`, {
                toolCallId: toolCall.id,
                phoneNumber: args.phone_number,
                message: args.message ? args.message.substring(0, 50) + '...' : null,
                scheduledTime: args.scheduled_time,
              });
              functionCalls.push({
                name: functionName,
                arguments: args,
                toolCallId: toolCall.id,
              });
            }
          }
        }
      }
    }

    console.log('[VAPI WEBHOOK] Extracted data:', {
      assistantId,
      assistantPhoneNumber,
      callerPhoneNumber: callerPhoneNumber || '(not found)',
      assistantSummary: assistantSummary ? assistantSummary.substring(0, 100) : '(empty)',
      functionCallsCount: functionCalls.length,
    });
    
    // Debug: Log function calls if found
    if (functionCalls.length > 0) {
      console.log('[VAPI WEBHOOK] Function calls found:', JSON.stringify(functionCalls, null, 2));
    }

    if (!assistantId) {
      console.error('[VAPI WEBHOOK ERROR] Missing assistant.id in payload');
      return NextResponse.json(
        { success: false, error: 'Missing assistant.id' },
        { status: 400 }
      );
    }

    // CRITICAL: Process schedule_outbound_call and make_outbound_call from end-of-call events
    // This handles cases where real-time webhook requests failed or weren't sent
    const allOutboundCallFunctionCalls = functionCalls.filter(
      (fc: any) => fc.name === 'schedule_outbound_call' || fc.name === 'make_outbound_call'
    );
    
    // Deduplicate by toolCallId to avoid processing the same call multiple times
    const seenToolCallIds = new Set<string>();
    const outboundCallFunctionCalls = allOutboundCallFunctionCalls.filter((fc: any) => {
      const toolCallId = fc.toolCallId || '';
      if (seenToolCallIds.has(toolCallId)) {
        console.log(`[VAPI WEBHOOK] Skipping duplicate function call with toolCallId: ${toolCallId}`);
        return false;
      }
      seenToolCallIds.add(toolCallId);
      return true;
    });
    
    if (outboundCallFunctionCalls.length > 0) {
      console.log(`[VAPI WEBHOOK] Found ${outboundCallFunctionCalls.length} outbound call function call(s) in end-of-call event`);
      
      // Get owner info to verify
      let ownerInfo = null;
      if (callerPhoneNumber) {
        ownerInfo = await getOwnerByPhoneNumber(callerPhoneNumber);
      }
      
      for (const callFunctionCall of outboundCallFunctionCalls) {
        const functionName = callFunctionCall.name;
        const args = callFunctionCall.arguments || {};
        const toolCallId = callFunctionCall.toolCallId || '';
        
        console.log(`[VAPI WEBHOOK] Processing ${functionName} from end-of-call event`, {
          toolCallId,
          phoneNumber: args.phone_number,
          message: args.message ? args.message.substring(0, 50) + '...' : null,
          scheduledTime: args.scheduled_time,
        });
        
        // Verify owner
        if (!ownerInfo) {
          console.warn(`[VAPI WEBHOOK] ${functionName} skipped: Owner not found for caller ${callerPhoneNumber}`);
          continue;
        }
        
        const agentIdIsSet = ownerInfo.agentId && 
                            ownerInfo.agentId !== '' && 
                            ownerInfo.agentId !== null && 
                            ownerInfo.agentId !== undefined;
        
        const isOwnerMatch = agentIdIsSet
          ? ownerInfo.agentId === assistantId 
          : true; // Phone number match is sufficient if agentId not set
        
        if (!isOwnerMatch) {
          console.warn(`[VAPI WEBHOOK] ${functionName} skipped: AgentId mismatch`);
          continue;
        }
        
        // Process the call request
        const phoneNumber = args.phone_number as string | undefined;
        const message = args.message as string | undefined;
        const callerName = (args.caller_name as string | undefined) || ownerInfo.fullName;
        
        if (!phoneNumber || !message) {
          console.warn(`[VAPI WEBHOOK] ${functionName} skipped: Missing phone_number or message`);
          continue;
        }
        
        // Format phone number
        const formatPhoneNumberToE164 = (phone: string): string | null => {
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
        };
        
        const formattedPhone = formatPhoneNumberToE164(phoneNumber);
        if (!formattedPhone) {
          console.warn(`[VAPI WEBHOOK] ${functionName} skipped: Invalid phone number format`);
          continue;
        }
        
        try {
          // CRITICAL: When processing from end-of-call event, ALWAYS schedule for 3 seconds from now
          // The call has already ended, so "after we hang up" means 3 seconds from processing time
          // Ignore any provided scheduled_time since the call is already over
          const scheduledTimeISO = new Date(Date.now() + 3 * 1000).toISOString();
          
          console.log(`[VAPI WEBHOOK] Processing ${functionName} from end-of-call event: Scheduling for 3 seconds from now:`, scheduledTimeISO);
          
          const task = await createScheduledCallTask({
            phone_number: formattedPhone,
            message: message,
            scheduled_time: scheduledTimeISO,
            owner_agent_id: assistantId,
            caller_name: callerName,
            phone_number_id: phoneNumberId || undefined,
            status: 'pending',
          });
          
          if (!task) {
            console.error(`[VAPI WEBHOOK] Failed to create scheduled call task from end-of-call event (table not configured)`);
            // Don't return error here since this is end-of-call processing - just log and continue
            continue;
          }
          
          console.log(`[VAPI WEBHOOK] Successfully scheduled call from end-of-call event for ${functionName}`, {
            taskId: task?.id,
            phoneNumber: formattedPhone,
            scheduledTime: scheduledTimeISO,
          });
        } catch (error) {
          console.error(`[VAPI WEBHOOK] Error processing ${functionName} from end-of-call event:`, error);
        }
      }
    }

    // Get owner's recordId from assistantId for pattern extraction and chat posting
    let ownerRecordId: string | null = null;
    let ownerThreadId: string | null = null;
    
    if (assistantId) {
      try {
        // Query Airtable to get recordId from agentId
        const filterFormula = `{vapi_agent_id} = "${assistantId}"`;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const tableId = process.env.AIRTABLE_TABLE_ID;
        if (baseId && tableId) {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(filterFormula)}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            const records = result.records || [];
            if (records.length > 0) {
              ownerRecordId = records[0].id;
              // Get or create threadId for this user
              if (ownerRecordId) {
                ownerThreadId = await getOrCreateThreadId(ownerRecordId);
                console.log('[VAPI WEBHOOK] Found owner recordId:', ownerRecordId, 'threadId:', ownerThreadId);
              }
            }
          }
        }
      } catch (error) {
        console.warn('[VAPI WEBHOOK WARNING] Failed to get owner recordId from agentId:', error);
      }
    }

    // Check if this call was initiated from chat and post results back
    const callId = payload.call?.id || payload.callId || payload.id || '';
    let chatInitiatedCall = false;
    if (callId) {
      try {
        const callRequest = await getOutboundCallRequestByCallId(callId);
        if (callRequest) {
          chatInitiatedCall = true;
          console.log('[VAPI WEBHOOK] Found chat-initiated call request:', {
            callId,
            recordId: callRequest.fields.recordId,
            threadId: callRequest.fields.threadId,
          });
          
          // Extract call results
          const callStatus = payload.status || payload.call?.status || 'completed';
          const phoneNumber = callerPhoneNumber || '';
          const phoneDisplay = phoneNumber.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
          
          // Check if call failed
          const isFailed = callStatus === 'failed' || 
                          callStatus === 'ended-abnormally' || 
                          payload.error ||
                          (payload.call && (payload.call.status === 'failed' || payload.call.status === 'ended-abnormally'));
          
          // Generate summary message for chat
          let chatMessage: string;
          if (isFailed) {
            // Handle failed calls
            const errorMessage = payload.error?.message || payload.message || 'The call failed to complete.';
            chatMessage = `I tried to call ${phoneDisplay || 'the number'}, but the call failed.\n\n${errorMessage}`;
          } else {
            // Handle successful calls
            chatMessage = `I called ${phoneDisplay || 'the number'}. Here's what happened:\n\n`;
            
            if (assistantSummary) {
              chatMessage += assistantSummary;
            } else {
              chatMessage += 'Call completed successfully.';
            }
          }
          
          // Get recordId from linked record (first element of array)
          const recordId = Array.isArray(callRequest.fields.recordId) 
            ? callRequest.fields.recordId[0] 
            : callRequest.fields.recordId;
          const threadId = callRequest.fields.threadId;
          
          // Post message back to chat
          try {
            await createChatMessage({
              recordId: recordId,
              agentId: assistantId,
              threadId: threadId,
              message: chatMessage,
              role: 'assistant',
            });
            console.log('[VAPI WEBHOOK] Posted call results back to chat:', {
              recordId,
              threadId,
              callId,
            });
            
            // Update call request status
            const finalStatus = isFailed ? 'failed' : 'completed';
            await updateOutboundCallRequest(callId, {
              status: finalStatus,
              completedAt: new Date().toISOString(),
            });
            
            // Save outbound call transcript to Call Notes table
            if (assistantSummary && !isFailed) {
              try {
                // Extract or calculate call duration
                let callDuration: number | undefined = undefined;
                if (payload.call?.duration || payload.duration) {
                  callDuration = payload.call?.duration || payload.duration;
                } else {
                  const startedAt = payload.call?.startedAt || payload.call?.createdAt || payload.startedAt || payload.createdAt;
                  const endedAt = payload.call?.endedAt || payload.endedAt || payload.call?.ended_at || payload.ended_at;
                  if (startedAt && endedAt) {
                    try {
                      const startTime = new Date(startedAt).getTime();
                      const endTime = new Date(endedAt).getTime();
                      if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
                        callDuration = Math.round((endTime - startTime) / 1000);
                      }
                    } catch (e) {
                      console.warn('[VAPI WEBHOOK] Failed to calculate call duration:', e);
                    }
                  }
                }
                
                // Get owner phone number for the call note
                const ownerPhone = await getOwnerPhoneByAgentId(assistantId);
                
                await createCallNote({
                  callId: callId,
                  agentId: assistantId,
                  callerPhone: phoneNumber || 'unknown',
                  note: assistantSummary,
                  ownerPhone: ownerPhone || undefined,
                  smsSent: false, // Outbound calls don't send SMS
                  callDuration: callDuration,
                  read: false,
                });
                console.log('[VAPI WEBHOOK] Saved outbound call transcript to Call Notes table:', {
                  callId,
                  agentId: assistantId,
                  phoneNumber: phoneDisplay,
                });
              } catch (noteError) {
                console.error('[VAPI WEBHOOK ERROR] Failed to save outbound call transcript to Call Notes:', noteError);
                // Continue processing - don't fail the webhook
              }
            }
          } catch (chatError) {
            console.error('[VAPI WEBHOOK ERROR] Failed to post call results to chat:', chatError);
            // Continue processing - don't fail the webhook
          }
        }
      } catch (error) {
        console.warn('[VAPI WEBHOOK WARNING] Error checking for chat-initiated call:', error);
        // Continue processing - don't fail the webhook
      }
    }

    // Phase 4: Post call summary to chat for ALL calls (not just chat-initiated)
    // Also extract patterns from call summary
    if (assistantSummary && ownerRecordId && ownerThreadId && !chatInitiatedCall) {
      try {
        const phoneNumber = callerPhoneNumber || '';
        const phoneDisplay = phoneNumber ? phoneNumber.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : 'unknown number';
        const callStatus = payload.status || payload.call?.status || 'completed';
        const isFailed = callStatus === 'failed' || 
                        callStatus === 'ended-abnormally' || 
                        payload.error ||
                        (payload.call && (payload.call.status === 'failed' || payload.call.status === 'ended-abnormally'));
        
        // Generate summary message for chat
        let chatMessage: string;
        if (isFailed) {
          const errorMessage = payload.error?.message || payload.message || 'The call failed to complete.';
          chatMessage = `Call to ${phoneDisplay} ended.\n\n${errorMessage}`;
        } else {
          chatMessage = `Call summary for ${phoneDisplay}:\n\n${assistantSummary}`;
        }
        
        // Post to chat
        await createChatMessage({
          recordId: ownerRecordId, // ownerRecordId is guaranteed to be non-null by the if condition
          agentId: assistantId,
          threadId: ownerThreadId, // ownerThreadId is guaranteed to be non-null by the if condition
          message: chatMessage,
          role: 'assistant',
        });
        console.log('[VAPI WEBHOOK] Posted call summary to chat for all calls:', {
          recordId: ownerRecordId,
          threadId: ownerThreadId,
          callId,
        });
        
        // Save outbound call transcript to Call Notes table (for non-chat-initiated calls)
        if (!isFailed && assistantSummary) {
          try {
            // Extract or calculate call duration
            let callDuration: number | undefined = undefined;
            if (payload.call?.duration || payload.duration) {
              callDuration = payload.call?.duration || payload.duration;
            } else {
              const startedAt = payload.call?.startedAt || payload.call?.createdAt || payload.startedAt || payload.createdAt;
              const endedAt = payload.call?.endedAt || payload.endedAt || payload.call?.ended_at || payload.ended_at;
              if (startedAt && endedAt) {
                try {
                  const startTime = new Date(startedAt).getTime();
                  const endTime = new Date(endedAt).getTime();
                  if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
                    callDuration = Math.round((endTime - startTime) / 1000);
                  }
                } catch (e) {
                  console.warn('[VAPI WEBHOOK] Failed to calculate call duration:', e);
                }
              }
            }
            
            // Get owner phone number for the call note
            const ownerInfo = await getOwnerPhoneByAgentId(assistantId);
            const ownerPhone = ownerInfo || '';
            
            await createCallNote({
              callId: callId || undefined,
              agentId: assistantId,
              callerPhone: phoneNumber || 'unknown',
              note: assistantSummary,
              ownerPhone: ownerPhone,
              smsSent: false, // Outbound calls don't send SMS
              callDuration: callDuration,
              read: false,
            });
            console.log('[VAPI WEBHOOK] Saved outbound call transcript to Call Notes table:', {
              callId,
              agentId: assistantId,
              phoneNumber: phoneDisplay,
            });
          } catch (noteError) {
            console.error('[VAPI WEBHOOK ERROR] Failed to save outbound call transcript to Call Notes:', noteError);
            // Continue processing - don't fail the webhook
          }
        }
      } catch (chatError) {
        console.error('[VAPI WEBHOOK ERROR] Failed to post call summary to chat:', chatError);
        // Continue processing - don't fail the webhook
      }
    }

    // Phase 2: Extract patterns from call summary
    if (assistantSummary && ownerRecordId) {
      try {
        const timestamp = new Date().toISOString();
        // Extract patterns from the call summary as if it were a user message
        // This allows us to learn patterns from what happened during calls
        await extractPatternsFromMessage(
          ownerRecordId, // ownerRecordId is guaranteed to be non-null by the if condition
          assistantSummary,
          'user', // Treat summary as user behavior pattern
          timestamp,
          [] // No previous messages context for call summaries
        ).catch(err => {
          console.warn('[VAPI WEBHOOK] Failed to extract patterns from call summary:', err);
        });
        console.log('[VAPI WEBHOOK] Extracted patterns from call summary');
      } catch (patternError) {
        console.warn('[VAPI WEBHOOK WARNING] Failed to extract patterns from call summary:', patternError);
        // Continue processing - pattern extraction is non-critical
      }
    }

    // Filter for capture_note function calls
    const noteFunctionCalls = functionCalls.filter(
      (fc: any) => fc.name === 'capture_note'
    );

    // If no notes found, check if we processed any outbound calls
    if (noteFunctionCalls.length === 0) {
      if (outboundCallFunctionCalls.length > 0) {
        console.log(`[VAPI WEBHOOK] End-of-call event processed: ${outboundCallFunctionCalls.length} outbound call(s) scheduled, no notes to process`);
      } else {
        console.log('[VAPI WEBHOOK] End-of-call event processed: No capture_note or outbound call function calls found in this call');
      }
      return NextResponse.json({ success: true, message: 'End-of-call event processed' });
    }

    console.log('[VAPI WEBHOOK] Found', noteFunctionCalls.length, 'note(s) to process');

    // Get owner's phone number from Airtable
    const ownerPhone = await getOwnerPhoneByAgentId(assistantId);

    if (!ownerPhone) {
      console.error('[VAPI WEBHOOK ERROR] Could not find owner phone for agentId:', assistantId);
      
      // Still save notes to Airtable even if we can't send SMS
      for (const noteCall of noteFunctionCalls) {
        const noteContent = noteCall.arguments?.note_content || '';
        const callerPhone = noteCall.arguments?.caller_phone || '';
        
        if (noteContent && callerPhone) {
          try {
            await createCallNote({
              agentId: assistantId,
              callerPhone,
              note: noteContent,
              ownerPhone: undefined,
              smsSent: false,
            });
            console.log('[VAPI WEBHOOK] Saved note to Airtable (no SMS sent - owner phone not found)');
          } catch (error) {
            console.error('[VAPI WEBHOOK ERROR] Failed to save note to Airtable:', error);
          }
        }
      }
      
      return NextResponse.json(
        { success: false, error: 'Owner phone not found' },
        { status: 404 }
      );
    }

    // Get the assistant's Canadian phone number from Airtable (for sending SMS)
    // Fallback to payload if not in Airtable yet
    let canadianPhoneNumber = assistantPhoneNumber;
    if (assistantId) {
      const canadianNumberInfo = await getCanadianNumberByAgentId(assistantId);
      if (canadianNumberInfo && canadianNumberInfo.phoneNumber) {
        canadianPhoneNumber = canadianNumberInfo.phoneNumber;
        console.log('[VAPI WEBHOOK] Using Canadian number from Airtable for SMS:', canadianPhoneNumber);
      } else if (assistantPhoneNumber) {
        console.log('[VAPI WEBHOOK] Using phone number from payload (not yet in Airtable):', assistantPhoneNumber);
      }
    }

    // Verify we have the assistant's phone number to send from
    if (!canadianPhoneNumber) {
      console.error('[VAPI WEBHOOK ERROR] Missing assistant phone number (checked both Airtable and payload)');
      return NextResponse.json(
        { success: false, error: 'Missing assistant phone number' },
        { status: 400 }
      );
    }

    // Process each note
    const results = [];
    for (const noteCall of noteFunctionCalls) {
      // Handle different possible argument formats
      const args = noteCall.arguments || noteCall.params || {};
      const noteContent = args.note_content || args.noteContent || '';
      // Use caller phone from args, or fallback to customer number from payload
      let callerPhone = args.caller_phone || args.callerPhone || callerPhoneNumber || '';

      if (!noteContent) {
        console.warn('[VAPI WEBHOOK WARNING] Note call missing note content');
        continue;
      }
      
      // If caller phone is still missing, log warning but continue (we'll use empty string)
      if (!callerPhone) {
        console.warn('[VAPI WEBHOOK WARNING] Caller phone not found in function call or payload');
      }

      // Format SMS message
      const smsMessage = `Kendall here — you received a new message.

From: ${callerPhone}
Message: "${noteContent}"

Call summary:
${assistantSummary}`;

      // Send SMS using the assistant's Canadian phone number as the sender
      let smsSent = false;
      let smsError: string | undefined;
      
      try {
        const smsResult = await sendSMS(ownerPhone, smsMessage, canadianPhoneNumber);
        smsSent = smsResult.success;
        if (!smsResult.success) {
          smsError = smsResult.error;
          console.error('[VAPI WEBHOOK ERROR] SMS send failed:', smsError);
        } else {
          console.log('[VAPI WEBHOOK] SMS sent successfully from', canadianPhoneNumber, 'to', ownerPhone);
        }
      } catch (error) {
        smsError = error instanceof Error ? error.message : 'Unknown error';
        console.error('[VAPI WEBHOOK ERROR] Exception while sending SMS:', error);
      }

      // Save note to Airtable
      try {
        // Extract callId from various possible locations in payload
        const callId = payload.call?.id || payload.callId || payload.id || undefined;
        
        // Extract or calculate call duration
        let callDuration: number | undefined = undefined;
        
        // Try to get duration directly from payload
        if (payload.call?.duration || payload.duration) {
          callDuration = payload.call?.duration || payload.duration;
        }
        // Otherwise, calculate from timestamps
        else {
          const startedAt = payload.call?.startedAt || payload.call?.createdAt || payload.startedAt || payload.createdAt;
          const endedAt = payload.call?.endedAt || payload.endedAt || payload.call?.ended_at || payload.ended_at;
          
          if (startedAt && endedAt) {
            try {
              const startTime = new Date(startedAt).getTime();
              const endTime = new Date(endedAt).getTime();
              if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
                callDuration = Math.round((endTime - startTime) / 1000); // Convert to seconds
              }
            } catch (e) {
              console.warn('[VAPI WEBHOOK] Failed to calculate call duration from timestamps:', e);
            }
          }
        }
        
        await createCallNote({
          callId,
          agentId: assistantId,
          callerPhone,
          note: noteContent,
          ownerPhone,
          smsSent,
          callDuration,
          read: false, // New messages are unread by default
        });
        console.log('[VAPI WEBHOOK] Saved note to Airtable, smsSent:', smsSent, 'callDuration:', callDuration);
      } catch (error) {
        console.error('[VAPI WEBHOOK ERROR] Failed to save note to Airtable:', error);
        // Continue processing other notes even if one fails
      }

      results.push({
        noteContent,
        callerPhone,
        smsSent,
        smsError,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} note(s)`,
      results,
    });
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[VAPI WEBHOOK ERROR] Exception processing webhook:', {
      error: errorMessage,
      stack: errorStack,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });
    
    // Try to extract toolCallId from payload for proper VAPI error response format
    let toolCallId = '';
    if (payload) {
      try {
        toolCallId = payload?.functionCall?.id || 
                     payload?.functionCall?.toolCallId || 
                     payload?.toolCallId ||
                     payload?.message?.artifact?.messages?.find((m: any) => m.toolCalls)?.[0]?.id ||
                     payload?.message?.messages?.find((m: any) => m.toolCalls)?.[0]?.id ||
                     '';
      } catch (e) {
        // If extraction fails, toolCallId stays empty
      }
    }
    
    // Return proper VAPI format if toolCallId found, otherwise generic error
    if (toolCallId) {
      return NextResponse.json({
        results: [
          {
            toolCallId: toolCallId,
            result: `Error: ${errorMessage}. Please try again or contact support if the issue persists.`,
          }
        ]
      }, { status: 500 });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    const responseTime = Date.now() - requestStartTime;
    console.log(`[VAPI WEBHOOK] Request processed in ${responseTime}ms`);
    
    // Log call metrics
    if (callMetrics.assistantId || callMetrics.callId) {
      const metrics = {
        assistantId: callMetrics.assistantId,
        callId: callMetrics.callId,
        duration: responseTime,
        firstTokenTime: callMetrics.firstTokenTime,
        toolCallsCount: callMetrics.toolCalls.length,
        toolRecalls: callMetrics.toolRecalls,
        droppedResponses: callMetrics.droppedResponses,
        functionFailures: callMetrics.functionFailures,
        toolCalls: callMetrics.toolCalls,
        timestamp: new Date().toISOString(),
      };
      console.log('[CALL METRICS]', JSON.stringify(metrics, null, 2));
    }
    
    // Warn if response time is approaching VAPI timeout (usually 30 seconds)
    if (responseTime > 25000) {
      console.warn(`[VAPI WEBHOOK] ⚠️  WARNING: Response time (${responseTime}ms) is approaching VAPI timeout threshold!`);
    } else if (responseTime > 10000) {
      console.warn(`[VAPI WEBHOOK] ⚠️  Response time (${responseTime}ms) is slow but within acceptable range.`);
    }
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'VAPI Webhook endpoint is active' });
}

