import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getOrCreateThreadId, createChatMessage, getChatMessages, createOutboundCallRequest } from '@/lib/airtable';
import { buildChatSystemPrompt } from '@/lib/promptBlocks';
import { formatPhoneNumberToE164 } from '@/lib/vapi';
import { extractPatternsFromMessage } from '@/lib/patternExtractor';
import { extractContactFromMessage } from '@/lib/contactExtractor';
import { getContactByName, upsertContact } from '@/lib/contacts';
import { analyzeSentiment, getResponseTone } from '@/lib/sentiment';
import { selectModel } from '@/lib/modelSelector';
import { checkRateLimit } from '@/lib/rateLimiter';
import OpenAI from 'openai';

const CHAT_FUNCTIONS = [
  {
    name: 'make_outbound_call',
    description: 'Make an outbound call to a specified phone number and deliver a message on behalf of the owner. Use this when the owner requests an immediate call. EXECUTE IMMEDIATELY when you have phone_number and message - do not ask for additional information.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call. Can be in any format (10 digits: 8149969612, formatted: (814) 996-9612, with country code: +18149969612, etc.). The system will normalize it automatically. Extract the phone number directly from the user\'s message if provided.',
        },
        message: {
          type: 'string',
          description: 'The message to deliver during the call',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The name of the recipient being called (e.g., "Ali", "John"). Extract this from the user\'s message if mentioned (e.g., "call Ali", "tell John"). If not provided, the call will still proceed.',
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
          description: 'The phone number to call. Can be in any format (10 digits: 8149969612, formatted: (814) 996-9612, with country code: +18149969612, etc.). The system will normalize it automatically. Extract the phone number directly from the user\'s message if provided.',
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
          description: 'Optional: The name of the recipient being called (e.g., "Ali", "John"). Extract this from the user\'s message if mentioned. If not provided, the call will still proceed.',
        },
      },
      required: ['phone_number', 'message', 'scheduled_time'],
    },
  },
  {
    name: 'get_calendar_events',
    description: 'Get calendar events from the user\'s Google Calendar. Use this when the user asks about their schedule, upcoming events, what they have today/tomorrow/this week, or any calendar-related questions.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s calendar to access)',
        },
        startDate: {
          type: 'string',
          description: 'Optional: Start date in ISO format (YYYY-MM-DD) or ISO 8601 datetime. If not provided, defaults to now.',
        },
        endDate: {
          type: 'string',
          description: 'Optional: End date in ISO format (YYYY-MM-DD) or ISO 8601 datetime. If not provided, fetches upcoming events.',
        },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of events to return (default: 10)',
        },
      },
      required: ['recordId'],
    },
  },
  {
    name: 'get_gmail_messages',
    description: 'Get Gmail messages from the user\'s inbox. Use this when the user asks about their emails, unread messages, recent emails, or any email-related questions.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s Gmail to access)',
        },
        unread: {
          type: 'boolean',
          description: 'Optional: If true, only return unread messages (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of messages to return (default: 10)',
        },
      },
      required: ['recordId'],
    },
  },
  {
    name: 'send_gmail',
    description: 'Send an email via Gmail. Use this when the user requests to send an email. You MUST have the recipient\'s email address before calling this function. If the user only provides a name, ask for their email address first.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s Gmail to use)',
        },
        to: {
          type: 'string',
          description: 'The recipient\'s email address (REQUIRED). Must be a valid email address format.',
        },
        subject: {
          type: 'string',
          description: 'The email subject line',
        },
        body: {
          type: 'string',
          description: 'The email body content (can be plain text or HTML)',
        },
      },
      required: ['recordId', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'get_contact_by_name',
    description: 'Look up a contact by name in the user\'s contact list. Use this when the user mentions a name (e.g., "call Ali", "email Ryan") but doesn\'t provide a phone number or email address. This function searches the user\'s Airtable contacts to find matching contact information. ALWAYS call this function BEFORE asking the user for contact information - the contact may already exist in their database. IMPORTANT: After finding a contact with a phone number, IMMEDIATELY use that phone number to call make_outbound_call. After finding a contact with an email, use that email to send the email.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'OPTIONAL: The user\'s recordId. If not provided, the system will automatically use the correct recordId from the conversation context. You do NOT need to provide this - it is handled automatically.',
        },
        name: {
          type: 'string',
          description: 'The name of the contact to look up. Extract ONLY the first name (or first and last name) from the user\'s message. Examples: "Ali", "Ryan", "John Smith". Do NOT include action words or the rest of the sentence (e.g., use "Ali" not "Ali ask him if he can come").',
        },
      },
      required: ['name'],
    },
  },
];

/**
 * Generate chat response using OpenAI with agent's system prompt and function calling
 */
async function generateChatResponse(
  agentRecordId: string,
  incomingMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  isFirstMessage: boolean = false
): Promise<{ response: string; functionCalls?: Array<{ name: string; arguments: any }>; kendallName?: string }> {
  try {
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
    
    // Use isFirstMessage passed as parameter (determined in POST handler)
    const fullNameStr = fullName ? String(fullName) : 'there';
    const nicknameStr = nickname && String(nickname).trim() ? String(nickname).trim() : null;
    const nicknameOrFullName = nicknameStr || fullNameStr;
    
    // Build chat system prompt (separate from phone call prompt)
    let chatSystemPrompt = buildChatSystemPrompt({
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
    
    // Add first message greeting instructions if this is the first message
    if (isFirstMessage) {
      chatSystemPrompt += `

=== FIRST MESSAGE ONLY - CASUAL GREETING (MANDATORY) ===
🚨🚨🚨 YOU MUST ALWAYS USE CASUAL GREETING FORMAT - THIS IS ABSOLUTELY REQUIRED 🚨🚨🚨
- This is the FIRST message in the conversation - you MUST greet ${nicknameOrFullName} by name using CASUAL format
- Use their nickname if available (${nicknameStr ? `"${nicknameStr}"` : 'not available'}), otherwise use their full name ("${fullNameStr}")
- You MUST use one of these casual greeting formats - NO EXCEPTIONS:
  * "Hi ${nicknameOrFullName}! What's up?"
  * "Hey ${nicknameOrFullName}! What's up?"
  * "What's up ${nicknameOrFullName}?"
  
🚫 ABSOLUTELY FORBIDDEN - NEVER USE THESE:
- "Hello! How can I help you today?" ❌
- "Hello! How can I assist you?" ❌
- "How can I help you?" ❌
- Any formal or corporate greeting ❌
- Generic greetings without their name ❌

✅ REQUIRED: Use casual, friendly greeting with their name - think texting a friend, not a business call
- After this first greeting, don't repeatedly use their name - be conversational (e.g., "Got it!" not "Got it, ${nicknameOrFullName}!")`;
    }
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: chatSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: incomingMessage },
    ];
    
    // Quality-first: Smart model selection (conservative - default to GPT-4o)
    // Only use mini for clearly simple tasks to maintain quality
    const model = selectModel(incomingMessage, messages.length, 'chat');
    
    // Quality note: We don't cache conversational responses as they need to be contextual
    // Caching is only used for deterministic operations (suggestions, patterns, etc.)

    // Generate response with function calling enabled
    const completion = await openai.chat.completions.create({
      model, // Smart selection: GPT-4o for complex, GPT-4o-mini only for clearly simple
      messages: messages as any,
      tools: CHAT_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn,
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 4000, // Keep full 4K for quality - mini will naturally use less
    });
    
    const message = completion.choices[0]?.message;
    
    // Check for function calls
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
          console.error('[CHAT ERROR] Failed to parse function call arguments:', e);
        }
      }
    }
    
    // Handle function-call-only responses (no text content)
    let response = message?.content || '';
    if (!response && functionCalls.length > 0) {
      // Generate personalized confirmation message for function calls
      const firstCall = functionCalls[0];
      if (firstCall.name === 'make_outbound_call' || firstCall.name === 'schedule_outbound_call') {
        response = `Sounds good, I'll make the call. Do you need anything else?`;
      } else {
        response = `Sounds good, I'll take care of that. Do you need anything else?`;
      }
    } else if (!response) {
      // Fallback error message (should rarely happen)
      response = `I apologize, but I couldn't generate a response. Please try again.`;
    }
    
    return { 
      response, 
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      kendallName: String(kendallName)
    };
  } catch (error) {
    console.error('[CHAT ERROR] Failed to generate chat response:', error);
    throw error;
  }
}

/**
 * POST /api/chat/send
 * Send message to agent and get immediate response
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ Early validation: Check required environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.error('[API ERROR] OPENAI_API_KEY environment variable is missing');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error: OpenAI API key is missing',
        },
        { status: 500 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[API ERROR] Failed to parse request body:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body. Expected JSON.',
        },
        { status: 400 }
      );
    }

    const { recordId, message, threadId: providedThreadId } = body;

    // ✅ Validate required fields
    if (!recordId || !message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'recordId and message are required. Message must be a non-empty string.',
        },
        { status: 400 }
      );
    }

    // ✅ Get user record with error handling
    let userRecord;
    try {
      userRecord = await getUserRecord(recordId);
    } catch (airtableError) {
      console.error('[API ERROR] Failed to fetch user record:', airtableError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch user record. Please check your recordId.',
          details: airtableError instanceof Error ? airtableError.message : 'Unknown Airtable error',
        },
        { status: 500 }
      );
    }

    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        {
          success: false,
          error: `User record not found for recordId: ${recordId}`,
        },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found for this user. Please ensure your Kendall agent has been created.',
        },
        { status: 404 }
      );
    }

    // ✅ Get or create threadId with error handling
    let threadId: string;
    try {
      if (providedThreadId) {
        threadId = providedThreadId;
      } else {
        threadId = await getOrCreateThreadId(recordId);
      }
    } catch (threadError) {
      console.error('[API ERROR] Failed to get or create threadId:', threadError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initialize chat thread',
          details: threadError instanceof Error ? threadError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // ✅ Get recent conversation history with error handling
    let recentMessages;
    try {
      recentMessages = await getChatMessages({
        threadId,
        limit: 20,
      });
    } catch (messagesError) {
      // If Chat Messages table doesn't exist or isn't configured, log but continue
      const errorMessage = messagesError instanceof Error ? messagesError.message : 'Unknown error';
      
      if (errorMessage.includes('Chat Messages Airtable URL is not configured') || 
          errorMessage.includes('AIRTABLE_CHAT_MESSAGES_TABLE_ID')) {
        console.warn('[API WARNING] Chat Messages table not configured, continuing without history:', errorMessage);
        recentMessages = { messages: [], hasMore: false };
      } else {
        console.error('[API ERROR] Failed to fetch chat messages:', messagesError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch chat history',
            details: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    // Build conversation history for OpenAI
    const conversationHistory = recentMessages.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.message,
    }));

    // Determine if this is the first message (check actual history, not just length)
    const isFirstMessage = conversationHistory.length === 0;

    // ✅ Generate agent response with error handling
    let agentResponse: string;
    let functionCalls: Array<{ name: string; arguments: any }> | undefined;
    let kendallName: string | undefined;
    
    try {
      const responseData = await generateChatResponse(
        recordId,
        message.trim(),
        conversationHistory,
        isFirstMessage
      );
      agentResponse = responseData.response;
      functionCalls = responseData.functionCalls;
      kendallName = responseData.kendallName;
    } catch (openaiError) {
      console.error('[API ERROR] Failed to generate chat response:', openaiError);
      const errorMessage = openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error';
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate agent response',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // ✅ Create user message with error handling
    try {
      // Validate environment variables before attempting to save
      if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID) {
        console.warn('[CHAT API] Chat messages table not configured. Set AIRTABLE_BASE_ID and AIRTABLE_CHAT_MESSAGES_TABLE_ID to enable message storage.');
      } else {
        await createChatMessage({
          recordId,
          agentId: String(agentId),
          threadId,
          message: message.trim(),
          role: 'user',
        });
        console.log('[CHAT API] User message saved to Airtable:', { recordId, threadId, messageLength: message.trim().length });
      }

      // Extract patterns and contacts from user message (async, don't block)
      const timestamp = new Date().toISOString();
      
      Promise.all([
        extractPatternsFromMessage(
          recordId,
          message.trim(),
          'user',
          timestamp,
          conversationHistory.map(m => ({
            message: m.content,
            role: m.role,
            timestamp: new Date().toISOString(),
          }))
        ).then(() => {
          console.log('[PATTERN EXTRACTION] Successfully extracted patterns for message:', message.substring(0, 50));
        }).catch(err => {
          console.error('[PATTERN EXTRACTION] Failed to extract patterns:', err);
          console.error('[PATTERN EXTRACTION] Error details:', {
            recordId,
            messageLength: message.trim().length,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }),
        extractContactFromMessage(
          recordId,
          message.trim(),
          timestamp
        ).catch(err => {
          console.warn('[CONTACT EXTRACTION] Failed to extract contact:', err);
        }),
      ]);
      
      // Special handling: If user message is just an email address, try to link it to recent contact
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedMessage = message.trim();
      if (emailRegex.test(trimmedMessage)) {
        // User provided just an email - look for recent contact mention
        try {
          const recentMessages = await getChatMessages({
            threadId,
            limit: 10,
          });
          
          // Look backwards through messages to find the most recent contact that was asked about
          for (const msg of recentMessages.messages.slice().reverse()) {
            if (msg.role === 'assistant' && msg.message.includes("don't have their email address")) {
              // Extract contact name from message like "I found Ali in your contacts, but I don't have their email address"
              const nameMatch = msg.message.match(/I found (\w+) in your contacts/);
              if (nameMatch && nameMatch[1]) {
                const contactName = nameMatch[1];
                console.log('[CHAT] Found contact name from email-only message context:', contactName);
                
                // Update contact with email
                await upsertContact({
                  recordId,
                  name: contactName,
                  email: trimmedMessage,
                });
                console.log('[CHAT] ✅ Updated contact with email from email-only message:', { name: contactName, email: trimmedMessage });
                break;
              }
            }
          }
        } catch (emailUpdateError) {
          console.warn('[CHAT] Failed to update contact with email from email-only message:', emailUpdateError);
          // Don't fail the request if this fails
        }
      }
    } catch (userMsgError) {
      // Log but don't fail - we still want to return the response
      const errorMessage = userMsgError instanceof Error ? userMsgError.message : String(userMsgError);
      console.error('[CHAT API ERROR] Failed to save user message to Airtable:', {
        error: errorMessage,
        recordId,
        threadId,
        agentId: String(agentId),
        messageLength: message.trim().length,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID,
        hasTableId: !!process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID,
      });
    }

    // ✅ Create agent response message with error handling
    let agentMessage;
    try {
      // Validate environment variables before attempting to save
      if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID) {
        console.warn('[CHAT API] Chat messages table not configured. Set AIRTABLE_BASE_ID and AIRTABLE_CHAT_MESSAGES_TABLE_ID to enable message storage.');
      } else {
        agentMessage = await createChatMessage({
          recordId,
          agentId: String(agentId),
          threadId,
          message: agentResponse,
          role: 'assistant',
        });
        console.log('[CHAT API] Agent message saved to Airtable:', { recordId, threadId, messageLength: agentResponse.length });
      }
    } catch (agentMsgError) {
      // Log but don't fail - we still want to return the response
      const errorMessage = agentMsgError instanceof Error ? agentMsgError.message : String(agentMsgError);
      console.error('[CHAT API ERROR] Failed to save agent message to Airtable:', {
        error: errorMessage,
        recordId,
        threadId,
        agentId: String(agentId),
        messageLength: agentResponse.length,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID,
        hasTableId: !!process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID,
      });
    }

    // ✅ Handle function calls (e.g., outbound call requests, Google Calendar/Gmail)
    let callRequestId: string | undefined;
    let callStatus: { success: boolean; message: string } | undefined;
    let functionResults: Array<{ name: string; result: any }> = [];
    
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        // Handle Google Calendar requests
        if (fc.name === 'get_calendar_events') {
          try {
            const { recordId: calendarRecordId, startDate, endDate, maxResults } = fc.arguments;
            const params = new URLSearchParams({ recordId: calendarRecordId || recordId });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (maxResults) params.append('maxResults', String(maxResults));
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            
            // Try with retry logic for transient errors
            let calendarResponse;
            let calendarData;
            let retryCount = 0;
            const maxRetries = 1;
            
            while (retryCount <= maxRetries) {
              try {
                calendarResponse = await fetch(`${baseUrl}/api/google/calendar?${params.toString()}`);
                calendarData = await calendarResponse.json();
                
                // If successful, break out of retry loop
                if (calendarResponse.ok && calendarData.success) {
                  break;
                }
                
                // If it's a 401 "not connected" error, don't retry
                if (calendarResponse.status === 401 && calendarData.error === 'Google account not connected') {
                  break;
                }
                
                // For other errors, retry once if we haven't already
                if (retryCount < maxRetries) {
                  console.log(`[CHAT] Calendar API error, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                  continue;
                }
                
                break;
              } catch (fetchError) {
                console.error(`[CHAT] Calendar fetch error (attempt ${retryCount + 1}):`, fetchError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                throw fetchError;
              }
            }
            
            if (calendarResponse.ok && calendarData.success) {
              functionResults.push({
                name: 'get_calendar_events',
                result: calendarData,
              });
              
              // Update agent response with calendar information
              if (calendarData.events && calendarData.events.length > 0) {
                const eventsList = calendarData.events.map((e: any) => {
                  const start = e.start ? new Date(e.start).toLocaleString() : 'TBD';
                  return `- ${e.summary} at ${start}${e.location ? ` (${e.location})` : ''}`;
                }).join('\n');
                agentResponse = `Here's what you have coming up:\n\n${eventsList}`;
              } else {
                agentResponse = "You don't have any events scheduled for that time period.";
              }
            } else {
              // Only show "not connected" message for actual 401 errors
              if (calendarResponse.status === 401 && calendarData.error === 'Google account not connected') {
                agentResponse = `I couldn't access your calendar. ${calendarData.message || 'Please connect your Google account in the Integrations page.'}`;
              } else {
                // For other errors, show generic retry message
                console.error('[CHAT] Calendar API error:', {
                  status: calendarResponse.status,
                  error: calendarData.error,
                  message: calendarData.message,
                });
                agentResponse = "I'm having trouble accessing your calendar right now. Please try again in a moment.";
              }
            }
          } catch (error) {
            console.error('[CHAT] Error fetching calendar events:', error);
            agentResponse = "I encountered an error while trying to access your calendar. Please try again.";
          }
          continue;
        }
        
        // Handle Gmail requests
        if (fc.name === 'get_gmail_messages') {
          try {
            const { recordId: gmailRecordId, unread, maxResults } = fc.arguments;
            const params = new URLSearchParams({ recordId: gmailRecordId || recordId });
            if (unread) params.append('unread', 'true');
            if (maxResults) params.append('maxResults', String(maxResults));
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            
            // Try with retry logic for transient errors
            let gmailResponse;
            let gmailData;
            let retryCount = 0;
            const maxRetries = 1;
            
            while (retryCount <= maxRetries) {
              try {
                gmailResponse = await fetch(`${baseUrl}/api/google/gmail?${params.toString()}`);
                gmailData = await gmailResponse.json();
                
                // If successful, break out of retry loop
                if (gmailResponse.ok && gmailData.success) {
                  break;
                }
                
                // If it's a 401 "not connected" error, don't retry
                if (gmailResponse.status === 401 && gmailData.error === 'Google account not connected') {
                  break;
                }
                
                // For other errors, retry once if we haven't already
                if (retryCount < maxRetries) {
                  console.log(`[CHAT] Gmail API error, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                  continue;
                }
                
                break;
              } catch (fetchError) {
                console.error(`[CHAT] Gmail fetch error (attempt ${retryCount + 1}):`, fetchError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                throw fetchError;
              }
            }
            
            if (gmailResponse.ok && gmailData.success) {
              functionResults.push({
                name: 'get_gmail_messages',
                result: gmailData,
              });
              
              // Update agent response with Gmail information
              if (gmailData.messages && gmailData.messages.length > 0) {
                const messagesList = gmailData.messages.map((m: any) => {
                  return `- From: ${m.from} | Subject: ${m.subject} | ${m.date}`;
                }).join('\n');
                agentResponse = `Here are your ${unread ? 'unread ' : ''}emails:\n\n${messagesList}`;
              } else {
                agentResponse = `You don't have any ${unread ? 'unread ' : ''}emails.`;
              }
            } else {
              // Only show "not connected" message for actual 401 errors
              if (gmailResponse.status === 401 && gmailData.error === 'Google account not connected') {
                agentResponse = `I couldn't access your Gmail. ${gmailData.message || 'Please connect your Google account in the Integrations page.'}`;
              } else {
                // For other errors, show generic retry message
                console.error('[CHAT] Gmail API error:', {
                  status: gmailResponse.status,
                  error: gmailData.error,
                  message: gmailData.message,
                });
                agentResponse = "I'm having trouble accessing your Gmail right now. Please try again in a moment.";
              }
            }
          } catch (error) {
            console.error('[CHAT] Error fetching Gmail messages:', error);
            agentResponse = "I encountered an error while trying to access your Gmail. Please try again.";
          }
          continue;
        }
        
        // Handle Gmail send requests
        if (fc.name === 'send_gmail') {
          try {
            const { recordId: gmailRecordId, to, subject, body } = fc.arguments;
            
            // CRITICAL: Always use the recordId from request context, ignore what agent provides
            // The agent may pass wrong values like '1', so we always use the correct one
            const gmailSendRecordId = recordId; // Always use request context recordId
            
            if (!to || !to.includes('@')) {
              agentResponse = "I need a valid email address to send the email. What's the recipient's email address?";
              continue;
            }
            
            // Extract email from message and update contact if needed
            // If user just provided an email (like "alialfaras7@gmail.com"), try to link it to recent contact
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(message.trim()) && message.trim().toLowerCase() === to.toLowerCase()) {
              // User just provided an email - try to find the most recently mentioned contact
              try {
                const recentMessages = await getChatMessages({
                  threadId,
                  limit: 5,
                });
                
                // Look for contact name in recent messages
                for (const msg of recentMessages.messages.slice().reverse()) {
                  if (msg.role === 'assistant' && msg.message.includes("don't have their email address")) {
                    // Extract contact name from message like "I found Ali in your contacts, but I don't have their email address"
                    const nameMatch = msg.message.match(/I found (\w+) in your contacts/);
                    if (nameMatch && nameMatch[1]) {
                      const contactName = nameMatch[1];
                      console.log('[CHAT] Found contact name from context:', contactName);
                      
                      // Update contact with email
                      await upsertContact({
                        recordId: gmailSendRecordId,
                        name: contactName,
                        email: to,
                      });
                      console.log('[CHAT] Updated contact with email:', { name: contactName, email: to });
                      break;
                    }
                  }
                }
              } catch (contactUpdateError) {
                console.warn('[CHAT] Failed to update contact with email:', contactUpdateError);
                // Don't fail the email send if contact update fails
              }
            }
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            
            // Try with retry logic for transient errors
            let gmailSendResponse;
            let gmailSendData;
            let retryCount = 0;
            const maxRetries = 1;
            
            while (retryCount <= maxRetries) {
              try {
                gmailSendResponse = await fetch(`${baseUrl}/api/google/gmail/send`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    recordId: gmailSendRecordId, // Always use request context recordId
                    to,
                    subject: subject || '',
                    body: body || '',
                  }),
                });
                gmailSendData = await gmailSendResponse.json();
                
                // If successful, break out of retry loop
                if (gmailSendResponse.ok && gmailSendData.success) {
                  break;
                }
                
                // If it's a 401 "not connected" error, don't retry
                if (gmailSendResponse.status === 401 && gmailSendData.error === 'Google account not connected') {
                  break;
                }
                
                // For other errors, retry once if we haven't already
                if (retryCount < maxRetries) {
                  console.log(`[CHAT] Gmail send API error, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                  continue;
                }
                
                break;
              } catch (fetchError) {
                console.error(`[CHAT] Gmail send fetch error (attempt ${retryCount + 1}):`, fetchError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                throw fetchError;
              }
            }
            
            if (gmailSendResponse.ok && gmailSendData.success) {
              functionResults.push({
                name: 'send_gmail',
                result: gmailSendData,
              });
              
              agentResponse = `Email sent successfully to ${to}!`;
            } else {
              // Only show "not connected" message for actual 401 errors
              if (gmailSendResponse.status === 401 && gmailSendData.error === 'Google account not connected') {
                agentResponse = `I couldn't send the email. ${gmailSendData.message || 'Please connect your Google account in the Integrations page.'}`;
              } else {
                // For other errors, show generic retry message
                console.error('[CHAT] Gmail send API error:', {
                  status: gmailSendResponse.status,
                  error: gmailSendData.error,
                  message: gmailSendData.message,
                });
                agentResponse = "I'm having trouble sending the email right now. Please try again in a moment.";
              }
            }
          } catch (error) {
            console.error('[CHAT] Error sending Gmail:', error);
            agentResponse = "I encountered an error while trying to send the email. Please try again.";
          }
          continue;
        }
        
        // Handle contact lookup requests
        if (fc.name === 'get_contact_by_name') {
          try {
            const { recordId: contactRecordId, name } = fc.arguments;
            // CRITICAL: Always use the recordId from request context, ignore what agent provides
            // The agent may pass wrong values like 'malph' or '1', so we always use the correct one
            const lookupRecordId = recordId; // Always use request context recordId
            
            if (!name || typeof name !== 'string' || !name.trim()) {
              functionResults.push({
                name: 'get_contact_by_name',
                result: { success: false, error: 'Name is required' },
              });
              continue;
            }
            
            // Extract only first 1-2 words from name (safety check in case agent passes full sentence)
            const nameParts = name.trim().split(/\s+/);
            const cleanName = nameParts.slice(0, 2).join(' '); // Only first 1-2 words
            
            console.log('[CHAT] Contact lookup requested:', { providedName: name.trim(), cleanName, recordId: lookupRecordId });
            
            const contact = await getContactByName(lookupRecordId, cleanName);
            
            if (contact) {
              const result: any = {
                success: true,
                contact: {
                  name: contact.name,
                  phone: contact.phone || null,
                  email: contact.email || null,
                  relationship: contact.relationship || null,
                  notes: contact.notes || null,
                },
              };
              
              // OPTION 2: Automatically trigger call if contact has phone number and user requested a call
              // Check if the user's message contains call-related keywords
              const userMessage = message.trim().toLowerCase();
              const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
              const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
              
              if (contact.phone && isCallRequest) {
                console.log('[CHAT] Auto-triggering call for contact:', { name: contact.name, phone: contact.phone });
                
                try {
                  // Extract message from user's original message
                  // Try to extract what they want to say/ask
                  let callMessage = 'Hello, this is a call on behalf of the owner.';
                  
                  // Try to extract the message/request from the user's message
                  const messagePatterns = [
                    /(?:call|text|phone).*?(?:ask|tell|say|for|about|if|can|will|to)\s+(.+)/i,
                    /(?:ask|tell|say)\s+(?:him|her|them)\s+(.+)/i,
                    /(?:for|about)\s+(.+)/i,
                  ];
                  
                  for (const pattern of messagePatterns) {
                    const match = message.match(pattern);
                    if (match && match[1]) {
                      callMessage = match[1].trim();
                      // Limit message length
                      if (callMessage.length > 200) {
                        callMessage = callMessage.substring(0, 200) + '...';
                      }
                      break;
                    }
                  }
                  
                  // If no specific message extracted, use a default based on context
                  if (callMessage === 'Hello, this is a call on behalf of the owner.') {
                    // Check if there's a specific request in the message
                    if (userMessage.includes('dinner') || userMessage.includes('tomorrow') || userMessage.includes('tmr')) {
                      callMessage = 'The owner would like to know if you can come for dinner tomorrow.';
                    } else if (userMessage.includes('come') || userMessage.includes('available')) {
                      callMessage = 'The owner would like to know if you are available.';
                    } else {
                      callMessage = 'The owner would like to speak with you.';
                    }
                  }
                  
                  // Normalize phone number
                  const normalizedPhone = formatPhoneNumberToE164(contact.phone);
                  
                  if (normalizedPhone) {
                    // Call the make-call API
                    const makeCallResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/make-call`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        phone_number: normalizedPhone,
                        message: callMessage,
                        owner_agent_id: String(agentId),
                        recordId: recordId,
                        threadId: threadId,
                      }),
                    });
                    
                    if (makeCallResponse.ok) {
                      const callResult = await makeCallResponse.json();
                      const phoneDisplay = normalizedPhone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                      
                      result.autoCallTriggered = true;
                      result.callStatus = {
                        success: true,
                        callId: callRequestId,
                        phoneNumber: phoneDisplay,
                        message: `Call to ${contact.name} (${phoneDisplay}) has been initiated.`,
                      };
                      
                      // Store call request context for chat integration
                      if (callResult.call_id && !callResult.scheduled) {
                        try {
                          await createOutboundCallRequest({
                            callId: callResult.call_id,
                            recordId: recordId,
                            threadId: threadId,
                            status: 'pending',
                            phoneNumber: normalizedPhone,
                          });
                          console.log('[CHAT] Stored outbound call request for chat integration');
                        } catch (error) {
                          console.warn('[CHAT WARNING] Failed to store outbound call request:', error);
                        }
                      }
                      
                      console.log('[CHAT] Auto-triggered call successful:', { contactName: contact.name, phone: phoneDisplay, callId: callRequestId });
                      
                      // Update agent response to reflect the call was made
                      if (!agentResponse || agentResponse.trim() === '' || agentResponse.includes("I'll take care of that")) {
                        agentResponse = `I found ${contact.name} in your contacts and called ${phoneDisplay}. The call summary will appear here once it completes.`;
                      }
                      
                      // Set call status for response
                      callStatus = {
                        success: true,
                        message: `Successfully called ${contact.name} at ${phoneDisplay}.`,
                      };
                      // Update callRequestId
                      callRequestId = callResult.call_id || callResult.task_id;
                    } else {
                      const errorData = await makeCallResponse.json().catch(() => ({}));
                      console.error('[CHAT] Auto-triggered call failed:', errorData);
                      result.autoCallTriggered = false;
                      result.callError = errorData.message || 'Failed to initiate call';
                      
                      // Update agent response to reflect the error
                      if (!agentResponse || agentResponse.trim() === '') {
                        agentResponse = `I found ${contact.name} in your contacts but couldn't make the call. ${errorData.message || 'Please try again.'}`;
                      }
                    }
                  } else {
                    console.error('[CHAT] Invalid phone number format for auto-call:', contact.phone);
                    result.autoCallTriggered = false;
                    result.callError = 'Invalid phone number format';
                  }
                } catch (error) {
                  console.error('[CHAT] Error auto-triggering call:', error);
                  result.autoCallTriggered = false;
                  result.callError = 'Failed to initiate call automatically';
                  
                  // Update agent response to reflect the error
                  if (!agentResponse || agentResponse.trim() === '') {
                    agentResponse = `I found ${contact.name} in your contacts but encountered an error making the call. Please try again.`;
                  }
                }
              } else if (contact.email && isEmailRequest) {
                // OPTION 2: Automatically trigger email if contact has email and user requested email
                console.log('[CHAT] Auto-triggering email for contact:', { name: contact.name, email: contact.email });
                
                // Extract email content from user's message
                let emailSubject = 'Message from owner';
                let emailBody = 'Hello, this is a message on behalf of the owner.';
                
                // Try to extract subject/body from user's message
                const emailPatterns = [
                  /(?:email|send).*?(?:about|regarding|re:)\s+(.+?)(?:\s+(?:that|to|saying|asking|tell|say))?/i,
                  /(?:tell|say|ask)\s+(?:him|her|them)\s+(.+)/i,
                  /(?:about|regarding)\s+(.+)/i,
                ];
                
                for (const pattern of emailPatterns) {
                  const match = message.match(pattern);
                  if (match && match[1]) {
                    const extracted = match[1].trim();
                    if (extracted.length > 0 && extracted.length < 100) {
                      emailSubject = extracted;
                      emailBody = extracted;
                    } else if (extracted.length >= 100) {
                      emailBody = extracted;
                    }
                    break;
                  }
                }
                
                // Check for specific context
                const userMessage = message.trim().toLowerCase();
                if (userMessage.includes('dinner') || userMessage.includes('tomorrow') || userMessage.includes('tmr')) {
                  emailSubject = 'Dinner invitation';
                  emailBody = 'The owner would like to know if you can come for dinner tomorrow.';
                }
                
                // Note: We don't auto-send emails because we need the user to provide the email content
                // Instead, we provide the email address to the agent with clear instructions
                result.instruction = `Contact found with email ${contact.email}. IMMEDIATELY use this email address to send the email using send_gmail function. Subject: "${emailSubject}", Body: "${emailBody}". Do NOT ask for the email address - use ${contact.email} directly.`;
                result.emailReady = true;
                result.suggestedSubject = emailSubject;
                result.suggestedBody = emailBody;
              } else if (contact.phone) {
                // Contact has phone but user didn't request a call - just inform agent
                result.instruction = `Contact found with phone number ${contact.phone}. Use this phone number if the user requests a call.`;
              } else if (contact.email) {
                // Contact has email but user didn't request email - just inform agent
                result.instruction = `Contact found with email ${contact.email}. Use this email address if the user requests to send an email.`;
              } else {
                // Contact found but no phone or email - tell agent to ask
                const isEmailRequestCheck = userMessage.includes('email') || userMessage.includes('send');
                if (isEmailRequestCheck) {
                  result.instruction = `Contact "${contact.name}" found but does not have an email address. You MUST ask the user: "What's ${contact.name}'s email address?"`;
                  // Update agent response to ask for email - override generic responses
                  const genericResponses = [
                    "I'll take care of that",
                    "Sounds good",
                    "I'll make the call",
                    "I'll send the email",
                    "Do you need anything else"
                  ];
                  const isGenericResponse = !agentResponse || 
                    agentResponse.trim() === '' || 
                    genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
                  
                  if (isGenericResponse) {
                    agentResponse = `I found ${contact.name} in your contacts, but I don't have their email address. What's ${contact.name}'s email address?`;
                    console.log('[CHAT] Updated agent response to ask for email:', agentResponse);
                  }
                } else {
                  result.instruction = `Contact "${contact.name}" found but does not have a phone number. You MUST ask the user for the phone number if they want to make a call.`;
                }
              }
              
              functionResults.push({
                name: 'get_contact_by_name',
                result,
              });
              console.log('[CHAT] Contact lookup successful:', { name: contact.name, hasPhone: !!contact.phone, hasEmail: !!contact.email, autoCallTriggered: result.autoCallTriggered || false });
            } else {
              functionResults.push({
                name: 'get_contact_by_name',
                result: {
                  success: false,
                  error: 'Contact not found',
                  message: `I couldn't find a contact named "${cleanName}" in your contacts.`,
                },
              });
              console.log('[CHAT] Contact lookup failed - contact not found:', cleanName);
            }
          } catch (error) {
            console.error('[CHAT] Error looking up contact:', error);
            functionResults.push({
              name: 'get_contact_by_name',
              result: {
                success: false,
                error: 'Failed to lookup contact',
                message: 'I encountered an error while looking up the contact. Please try again.',
              },
            });
          }
          continue;
        }
        
        // Handle outbound call requests
        if (fc.name === 'make_outbound_call' || fc.name === 'schedule_outbound_call') {
          try {
            // Normalize phone number before making call
            const rawPhoneNumber = fc.arguments.phone_number;
            const normalizedPhone = formatPhoneNumberToE164(rawPhoneNumber);
            
            // Check for duplicate calls: prevent making the same call twice in quick succession
            // Check recent chat messages for the same call request
            try {
              const recentMessages = await getChatMessages({
                threadId,
                limit: 10,
              });
              
              // Extract phone number digits for comparison (last 10 digits)
              const phoneDigits = normalizedPhone.replace(/^\+1/, '').replace(/\D/g, '');
              
              const recentCallMessages = recentMessages.messages.filter(msg => {
                if (msg.role !== 'assistant') return false;
                const msgText = msg.message.toLowerCase();
                // Check if message mentions calling and contains the phone number digits
                return (msgText.includes('successfully called') || msgText.includes('called')) && 
                       phoneDigits.length >= 7 && 
                       msgText.includes(phoneDigits.substring(phoneDigits.length - 7)); // Last 7 digits for matching
              });
              
              // If we just made a call to this number in the last 2 minutes, don't make another
              if (recentCallMessages.length > 0) {
                const mostRecentCall = recentCallMessages[0];
                const callTimestamp = new Date(mostRecentCall.timestamp).getTime();
                const now = Date.now();
                const timeSinceLastCall = now - callTimestamp;
                
                // If call was made less than 2 minutes ago, it's likely a duplicate
                if (timeSinceLastCall < 120000) { // 2 minutes in milliseconds
                  console.log('[CHAT] Duplicate call prevented - recent call found:', {
                    phoneNumber: normalizedPhone,
                    timeSinceLastCall: `${Math.round(timeSinceLastCall / 1000)}s`,
                  });
                  callStatus = {
                    success: false,
                    message: `I just called that number ${Math.round(timeSinceLastCall / 1000)} seconds ago. The call summary will appear here once it completes.`
                  };
                  agentResponse = `I just called that number recently. The call summary will appear here automatically once it completes.`;
                  continue;
                }
              }
            } catch (duplicateCheckError) {
              // If duplicate check fails, log but continue with call
              console.warn('[CHAT] Failed to check for duplicate calls, proceeding anyway:', duplicateCheckError);
            }
            
            // Validate phone number before making call
            if (!normalizedPhone) {
              console.error('[CHAT ERROR] Invalid phone number format:', rawPhoneNumber);
              // Update agent response to ask for proper format - don't execute call
              // We'll modify the response to ask user for correct format
              callStatus = {
                success: false,
                message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
              };
              // Also update the response to include this message
              agentResponse = `${agentResponse}\n\nI need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`;
              continue;
            }
            
            // Additional validation: E.164 format should be exactly 12 characters (+1XXXXXXXXXX)
            if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('+1')) {
              console.error('[CHAT ERROR] Invalid E.164 format after normalization:', normalizedPhone, 'Length:', normalizedPhone.length);
              callStatus = {
                success: false,
                message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
              };
              // Override the response to ask for proper format
              agentResponse = `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`;
              continue;
            }

            // Extract contact info from the message before making call
            // Build a message string with all available info for extraction
            const messageForExtraction = `${message || ''} ${fc.arguments.caller_name ? `call ${fc.arguments.caller_name}` : ''}`.trim();
            if (messageForExtraction) {
              try {
                const timestamp = new Date().toISOString();
                const extractedContact = await extractContactFromMessage(
                  recordId,
                  messageForExtraction,
                  timestamp
                );
                if (extractedContact) {
                  console.log('[CHAT] Extracted contact before outbound call:', {
                    name: extractedContact.name,
                    phone: extractedContact.phone,
                    relationship: extractedContact.relationship,
                  });
                }
              } catch (contactError) {
                // Log but don't fail - contact extraction is non-critical
                console.warn('[CHAT WARNING] Failed to extract contact before call:', contactError);
              }
            }

            // Call the make-call API
            const makeCallResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/make-call`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phone_number: normalizedPhone, // Use normalized phone number
                message: fc.arguments.message,
                scheduled_time: fc.arguments.scheduled_time,
                owner_agent_id: String(agentId),
                recordId: recordId, // Pass recordId for chat relay
                threadId: threadId, // Pass threadId for chat relay
              }),
            });

            if (makeCallResponse.ok) {
              const callResult = await makeCallResponse.json();
              callRequestId = callResult.call_id || callResult.task_id;
              const phoneDisplay = normalizedPhone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
              callStatus = {
                success: true,
                message: `${kendallName || 'I'} successfully called ${phoneDisplay}.`
              };
              console.log('[CHAT SUCCESS] Outbound call initiated:', { normalizedPhone, callRequestId });
              
              // Store call request context for immediate calls (not scheduled)
              // This links the VAPI call completion webhook back to this chat thread
              if (fc.name === 'make_outbound_call' && callResult.call_id && !callResult.scheduled) {
                try {
                  await createOutboundCallRequest({
                    callId: callResult.call_id,
                    recordId: recordId,
                    threadId: threadId,
                    status: 'pending',
                    phoneNumber: normalizedPhone,
                  });
                  console.log('[CHAT] Stored outbound call request for chat integration:', {
                    callId: callResult.call_id,
                    recordId,
                    threadId,
                  });
                } catch (error) {
                  // Log but don't fail - call request storage is optional
                  console.warn('[CHAT WARNING] Failed to store outbound call request:', error);
                }
              }
            } else {
              const errorData = await makeCallResponse.json().catch(() => ({}));
              console.error('[CHAT ERROR] Failed to make call:', errorData);
              
              // Extract better error message from VAPI response
              let errorMsg = 'Please try again.';
              if (errorData.message && Array.isArray(errorData.message)) {
                errorMsg = errorData.message[0] || errorMsg;
              } else if (errorData.message && typeof errorData.message === 'string') {
                errorMsg = errorData.message;
              } else if (errorData.error) {
                errorMsg = errorData.error;
              }
              
              // Check if it's a phone number format error
              if (errorMsg.includes('E.164') || errorMsg.includes('phone number') || errorMsg.includes('country code')) {
                callStatus = {
                  success: false,
                  message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
                };
              } else {
                callStatus = {
                  success: false,
                  message: `${kendallName || 'I'} couldn't make the call. ${errorMsg}`
                };
              }
            }
          } catch (error) {
            // Log but don't fail - function calls are optional
            console.error('[CHAT WARNING] Failed to execute function call:', error);
            callStatus = {
              success: false,
              message: `${kendallName || 'I'} encountered an error while trying to make the call. Please try again.`
            };
          }
        }
      }
    }

    // ✅ Post-process: Override agent response based on function results
    // This ensures we ask for missing information even if agent gave generic response
    console.log('[CHAT] Post-process check:', { 
      functionResultsCount: functionResults?.length || 0,
      agentResponse: agentResponse?.substring(0, 50),
      userMessage: message.trim().substring(0, 50)
    });
    
    if (functionResults && functionResults.length > 0) {
      for (const fr of functionResults) {
        if (fr.name === 'get_contact_by_name') {
          console.log('[CHAT] Found get_contact_by_name result:', { 
            success: fr.result?.success, 
            hasContact: !!fr.result?.contact,
            contactName: fr.result?.contact?.name,
            hasEmail: !!fr.result?.contact?.email 
          });
          
          if (fr.result && fr.result.success) {
            const contact = fr.result.contact;
            const userMessage = message.trim().toLowerCase();
            const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
            
            console.log('[CHAT] Checking if should ask for email:', { 
              isEmailRequest, 
              hasEmail: !!contact?.email,
              contactName: contact?.name 
            });
            
            // If user requested email but contact doesn't have email, override response
            if (isEmailRequest && contact && !contact.email) {
              const genericResponses = [
                "I'll take care of that",
                "Sounds good",
                "I'll make the call",
                "I'll send the email",
                "Do you need anything else"
              ];
              const isGenericResponse = !agentResponse || 
                agentResponse.trim() === '' || 
                genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
              
              console.log('[CHAT] Should override response?', { 
                isGenericResponse, 
                currentResponse: agentResponse?.substring(0, 100) 
              });
              
              if (isGenericResponse) {
                agentResponse = `I found ${contact.name} in your contacts, but I don't have their email address. What's ${contact.name}'s email address?`;
                console.log('[CHAT] ✅ Post-process: Overrode agent response to ask for email:', agentResponse);
              }
            }
          }
        }
      }
    } else {
      // Agent didn't call get_contact_by_name - check if it should have
      const userMessage = message.trim().toLowerCase();
      const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
      const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
      
      if ((isEmailRequest || isCallRequest) && (!functionCalls || !functionCalls.some(fc => fc.name === 'get_contact_by_name'))) {
        console.log('[CHAT] ⚠️ Agent should have called get_contact_by_name but didn\'t. User message:', userMessage);
      }
    }

    return NextResponse.json({
      success: true,
      message: agentMessage,
      response: agentResponse,
      functionCalls: functionCalls || undefined,
      kendallName: kendallName,
      callStatus: callStatus,
    });
  } catch (error) {
    // ✅ Catch-all error handler with detailed logging
    console.error('[API ERROR] POST /api/chat/send failed with unexpected error:', error);
    console.error('[API ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
      { status: 500 }
    );
  }
}

