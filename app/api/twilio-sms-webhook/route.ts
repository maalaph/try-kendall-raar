import { NextRequest, NextResponse } from 'next/server';
import { getAgentByCanadianNumber, getCanadianNumberByAgentId, getUserRecord } from '@/lib/airtable';
import { sendSMS } from '@/lib/sms';
import { buildSystemPrompt } from '@/lib/promptBlocks';
import OpenAI from 'openai';

/**
 * Generate SMS response using OpenAI with agent's system prompt
 */
async function generateSMSResponse(
  agentRecordId: string,
  incomingMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  try {
    console.log('[TWILIO SMS] Generating response for agent record:', agentRecordId);
    
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
    // CRITICAL: SMS is ALWAYS inbound - never an outbound call
    const smsSystemPrompt = `${systemPrompt}

=== SMS-SPECIFIC INSTRUCTIONS (OVERRIDE VOICE CALL INSTRUCTIONS) ===
🚨 CRITICAL: This is an SMS conversation, NOT a voice call. Ignore all outbound call instructions above.

**SMS CONTEXT:**
- This is an INBOUND SMS message (someone is texting you)
- This is NOT an outbound call - ignore all "outbound call" instructions
- The phrase "I have a message for you" is ONLY for outbound voice calls, NEVER use it in SMS
- DO NOT mention "variableValues.message" or "metadata.message" - those are for voice calls only
- Respond naturally to what the person actually texted you

**OWNER RECOGNITION:**
- If the sender's phone number matches {{ownerPhoneNumber}}, they are the owner
- If they are the owner, greet them naturally: "Hi {{nickname_or_full_name}}, how can I assist you?"
- If they are NOT the owner, greet them normally: "Hello, how can I help you?"

**RESPONSE GUIDELINES:**
- Keep responses concise (under 160 characters when possible, but can be longer if needed)
- Respond directly to what they texted - don't make up messages or information
- You can handle the same functions as voice calls: make_outbound_call, schedule_outbound_call, capture_note
- For outbound call requests via SMS, use the appropriate function
- For message forwarding, use capture_note function
- Be conversational and natural, but efficient
- DO NOT say "I have a message for you" unless you're actually delivering a specific message they asked you to send`;
    
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
    
    // Generate response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const response = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    console.log('[TWILIO SMS] Generated response:', response);
    
    return response;
  } catch (error) {
    console.error('[TWILIO SMS ERROR] Failed to generate SMS response:', error);
    throw error;
  }
}

/**
 * POST /api/twilio-sms-webhook
 * Handles incoming SMS messages from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TWILIO SMS] ===== SMS WEBHOOK CALLED =====');
    
    // Parse form data from Twilio (Twilio sends form-encoded data)
    const formData = await request.formData();
    const fromNumber = formData.get('From')?.toString();
    const toNumber = formData.get('To')?.toString();
    const messageBody = formData.get('Body')?.toString();
    
    console.log('[TWILIO SMS] Received SMS:', {
      from: fromNumber,
      to: toNumber,
      body: messageBody,
    });
    
    if (!fromNumber || !toNumber || !messageBody) {
      console.error('[TWILIO SMS ERROR] Missing required SMS data');
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    // Find agent by Canadian phone number (to number)
    const agentInfo = await getAgentByCanadianNumber(toNumber);
    if (!agentInfo) {
      console.error('[TWILIO SMS ERROR] Could not find agent for Canadian number:', toNumber);
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    console.log('[TWILIO SMS] Found agent:', {
      agentId: agentInfo.agentId,
      fullName: agentInfo.fullName,
      recordId: agentInfo.recordId,
    });
    
    // Get agent's Canadian number for sending response
    const canadianNumberInfo = await getCanadianNumberByAgentId(agentInfo.agentId);
    const canadianPhoneNumber = canadianNumberInfo?.phoneNumber;
    
    if (!canadianPhoneNumber) {
      console.error('[TWILIO SMS ERROR] Could not find Canadian phone number for agent:', agentInfo.agentId);
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
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
      console.log('[TWILIO SMS] Sender is the owner, adding owner context');
    } else {
      console.log('[TWILIO SMS] Sender is NOT the owner');
    }
    
    // Generate SMS response using OpenAI
    // TODO: Implement conversation history storage/retrieval for context
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const responseText = await generateSMSResponse(agentInfo.recordId, contextualMessage, conversationHistory);
    
    // Send SMS response
    const smsResult = await sendSMS(fromNumber, responseText, canadianPhoneNumber);
    
    if (!smsResult.success) {
      console.error('[TWILIO SMS ERROR] Failed to send SMS response:', smsResult.error);
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    console.log('[TWILIO SMS] Successfully sent SMS response:', {
      to: fromNumber,
      from: canadianPhoneNumber,
      messageId: smsResult.messageSid,
    });
    
    // Return empty TwiML response (Twilio expects TwiML)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
    
  } catch (error) {
    console.error('[TWILIO SMS ERROR] Exception in SMS webhook:', error);
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}


