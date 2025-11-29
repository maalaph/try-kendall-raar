import { NextRequest, NextResponse } from 'next/server';
import { getOwnerPhoneByAgentId, createCallNote } from '@/lib/airtable';
import { sendSMS } from '@/lib/sms';

/**
 * VAPI Webhook Handler
 * Handles assistant.result events from VAPI
 * Processes capture_note function calls and sends SMS to owners
 */
export async function POST(request: NextRequest) {
  try {
    // Parse webhook payload
    const payload = await request.json();
    
    // Log FULL payload for debugging - this will help us see what VAPI actually sends
    console.log('[VAPI WEBHOOK] Full payload received:', JSON.stringify(payload, null, 2));
    
    // Check for different possible event types
    const eventType = payload.type || payload.event || payload.message?.type || payload.status;
    console.log('[VAPI WEBHOOK] Event type detected:', eventType);
    
    // VAPI might send different event types. We need to handle:
    // - "assistant.result" (end of call with summary)
    // - "function-call" (when function is called during call)
    // - "status-update" (call status changes)
    // - "end-of-call-report" (alternative name)
    // - "call-end" or similar
    
    // Check if this is an end-of-call event (where we get function calls)
    const isEndOfCallEvent = 
      eventType === 'assistant.result' ||
      eventType === 'end-of-call-report' ||
      eventType === 'end-of-call' ||
      eventType === 'call-end' ||
      payload.status === 'ended' ||
      payload.call?.status === 'ended' ||
      payload.state === 'ended';
    
    if (!isEndOfCallEvent) {
      console.log('[VAPI WEBHOOK] Not an end-of-call event, ignoring. Event type:', eventType);
      return NextResponse.json({ success: true, message: 'Event type not handled' });
    }

    // Extract required data from payload - try multiple possible structures
    // Check if payload is nested in a 'message' field
    const actualPayload = payload.message || payload;
    
    const assistantId = 
      actualPayload.assistant?.id || 
      payload.assistant?.id || 
      payload.assistantId || 
      payload.assistant_id ||

      
      payload.summary || 
      payload.message?.summary ||
      payload.call?.summary ||
      actualPayload.transcript ||
      payload.transcript ||
      '';
    
    // Get caller phone number from payload (to replace placeholder in function calls)
    const callerPhoneNumber = 
      actualPayload.customer?.number || 
      payload.customer?.number || 
      actualPayload.customer?.phone || 
      payload.customer?.phone || 
      '';
    
    // Debug logging for phone number extraction
    if (!assistantPhoneNumber || !callerPhoneNumber) {
      console.log('[VAPI WEBHOOK] Phone number extraction debug:', {
        'payload.phoneNumber': payload.phoneNumber,
        'payload.phoneNumber?.number': payload.phoneNumber?.number,
        'payload.customer': payload.customer,
        'payload.customer?.number': payload.customer?.number,
        'extractedAssistantPhone': assistantPhoneNumber,
        'extractedCallerPhone': callerPhoneNumber,
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
    const messagesArray = actualPayload.messages || payload.messages;
    if (messagesArray && Array.isArray(messagesArray)) {
      for (const msg of messagesArray) {
        // Check for toolCalls field (this is where VAPI stores function calls)
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const toolCall of msg.toolCalls) {
            if (toolCall.function?.name === 'capture_note') {
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
              });
            }
          }
        }
        
        // Also check for role === 'tool_calls' (alternative format)
        if (msg.role === 'tool_calls' && msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const toolCall of msg.toolCalls) {
            if (toolCall.function?.name === 'capture_note') {
              let args = toolCall.function.arguments;
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch (e) {
                  console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                  continue;
                }
              }
              
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
              });
            }
          }
        }
        
        // Also check for OpenAI-formatted messages (messagesOpenAIFormatted)
        if (msg.role === 'assistant' && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const toolCall of msg.tool_calls) {
            if (toolCall.function?.name === 'capture_note') {
              let args = toolCall.function.arguments;
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch (e) {
                  console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                  continue;
                }
              }
              
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
            if (toolCall.function?.name === 'capture_note') {
              let args = toolCall.function.arguments;
              if (typeof args === 'string') {
                try {
                  args = JSON.parse(args);
                } catch (e) {
                  console.warn('[VAPI WEBHOOK] Failed to parse function arguments:', e);
                  continue;
                }
              }
              
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

    // Filter for capture_note function calls
    const noteFunctionCalls = functionCalls.filter(
      (fc: any) => fc.name === 'capture_note'
    );

    // If no notes found, do nothing (normal case)
    if (noteFunctionCalls.length === 0) {
      console.log('[VAPI WEBHOOK] No capture_note function calls found in this call');
      return NextResponse.json({ success: true, message: 'No notes to process' });
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

    // Verify we have the assistant's phone number to send from
    if (!assistantPhoneNumber) {
      console.error('[VAPI WEBHOOK ERROR] Missing assistant phone number in payload');
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

      // Send SMS using the assistant's own phone number as the sender
      let smsSent = false;
      let smsError: string | undefined;
      
      try {
        const smsResult = await sendSMS(ownerPhone, smsMessage, assistantPhoneNumber);
        smsSent = smsResult.success;
        if (!smsResult.success) {
          smsError = smsResult.error;
          console.error('[VAPI WEBHOOK ERROR] SMS send failed:', smsError);
        } else {
          console.log('[VAPI WEBHOOK] SMS sent successfully from', assistantPhoneNumber, 'to', ownerPhone);
        }
      } catch (error) {
        smsError = error instanceof Error ? error.message : 'Unknown error';
        console.error('[VAPI WEBHOOK ERROR] Exception while sending SMS:', error);
      }

      // Save note to Airtable
      try {
        // Extract callId from various possible locations in payload
        const callId = payload.call?.id || payload.callId || payload.id || undefined;
        
        await createCallNote({
          callId,
          agentId: assistantId,
          callerPhone,
          note: noteContent,
          ownerPhone,
          smsSent,
        });
        console.log('[VAPI WEBHOOK] Saved note to Airtable, smsSent:', smsSent);
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
    console.error('[VAPI WEBHOOK ERROR] Exception processing webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'VAPI Webhook endpoint is active' });
}

