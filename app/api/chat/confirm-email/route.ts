import { NextRequest, NextResponse } from 'next/server';
import { sendGmailMessage, GoogleIntegrationError } from '@/lib/integrations/google';
import { upsertContact, getContactByEmail, getChatMessages } from '@/lib/database';
import { createChatMessage } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, recordId, threadId } = body;

    // Validate required fields
    if (!to || !emailBody || !recordId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: to, body, and recordId are required',
        },
        { status: 400 }
      );
    }

    if (!to.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
        },
        { status: 400 }
      );
    }

    // Send the email
    try {
      await sendGmailMessage(recordId, {
        to,
        subject: subject || '',
        body: emailBody,
      });

      // Update contact information after successful send
      try {
        // Try to find contact name from recent conversation
        let resolvedContactName: string | null = null;
        
        if (threadId) {
          try {
            const recentMessages = await getChatMessages({
              threadId,
              limit: 10,
            });
            
            // Look for contact name mentioned in recent conversation
            for (const msg of recentMessages.messages.slice().reverse()) {
              // Check user messages for patterns like "email ryan", "call john", etc.
              if (msg.role === 'user') {
                const emailPatterns = [
                  /email\s+(?:to\s+)?(\w+)/i,
                  /send\s+(?:an?\s+)?email\s+(?:to\s+)?(\w+)/i,
                  /email\s+(\w+)/i,
                ];
                
                for (const pattern of emailPatterns) {
                  const match = msg.message.match(pattern);
                  if (match && match[1]) {
                    resolvedContactName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                    break;
                  }
                }
                
                if (resolvedContactName) break;
              }
              
              // Check assistant messages for contact lookup context
              if (msg.role === 'assistant' && (msg.message.includes("don't have") || msg.message.includes("in your contacts"))) {
                const namePatterns = [
                  /I found (\w+) in your contacts/i,
                  /don't have (\w+) in your contacts/i,
                  /I don't have (\w+)'s (?:email|phone)/i,
                  /What's (\w+)'s email/i,
                ];
                
                for (const pattern of namePatterns) {
                  const match = msg.message.match(pattern);
                  if (match && match[1]) {
                    resolvedContactName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                    break;
                  }
                }
                
                if (resolvedContactName) break;
              }
            }
          } catch (contextError) {
            console.warn('[CONFIRM-EMAIL] Failed to check conversation context:', contextError);
          }
        }
        
        if (resolvedContactName) {
          // Update contact with name and email
          await upsertContact({
            recordId,
            name: resolvedContactName,
            email: to,
            lastContacted: new Date().toISOString(),
          });
          console.log('[CONFIRM-EMAIL] ✅ Contact synced after email send:', {
            name: resolvedContactName,
            email: to,
          });
        } else {
          // Check if contact exists by email
          const existingContactByEmail = await getContactByEmail(recordId, to);
          
          if (existingContactByEmail) {
            // Contact exists - just update lastContacted
            await upsertContact({
              recordId,
              name: existingContactByEmail.name,
              email: to,
              lastContacted: new Date().toISOString(),
            });
            console.log('[CONFIRM-EMAIL] ✅ Updated existing contact after email send');
          } else {
            // Extract name from email as fallback
            const emailNameMatch = to.match(/^([^@]+)@/);
            if (emailNameMatch) {
              const potentialName = emailNameMatch[1].split(/[._0-9]/)[0];
              if (potentialName && potentialName.length > 1) {
                const capitalizedName = potentialName.charAt(0).toUpperCase() + potentialName.slice(1).toLowerCase();
                await upsertContact({
                  recordId,
                  name: capitalizedName,
                  email: to,
                  lastContacted: new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (contactSyncError) {
        console.error('[CONFIRM-EMAIL] ❌ Failed to sync contact after email send:', contactSyncError);
        // Don't fail the request if contact sync fails
      }

      // Create confirmation message in chat
      const safeSubject = (subject || '').trim() || '(no subject)';
      const confirmationMessage = `✅ Email sent to ${to} with subject "${safeSubject}"`;
      
      if (threadId) {
        try {
          await createChatMessage({
            threadId,
            role: 'assistant',
            message: confirmationMessage,
            recordId,
          });
        } catch (messageError) {
          console.warn('[CONFIRM-EMAIL] Failed to create confirmation message:', messageError);
          // Don't fail the request if message creation fails
        }
      }

      return NextResponse.json({
        success: true,
        message: confirmationMessage,
      });
    } catch (error) {
      console.error('[CONFIRM-EMAIL] ❌ Gmail send error:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof GoogleIntegrationError ? error.reason : 'UNKNOWN',
        recordId,
        to,
        subject: subject?.substring(0, 50),
      });

      if (error instanceof GoogleIntegrationError) {
        const errorMessage =
          error.reason === 'NOT_CONNECTED'
            ? "I couldn't send the email because Google isn't connected yet. You can connect it in the Integrations page."
            : error.reason === 'TOKEN_REFRESH_FAILED'
            ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
            : error.reason === 'INSUFFICIENT_PERMISSIONS'
            ? "Google is connected but missing permission to send emails. Please reconnect Google and allow Gmail access."
            : error.message || "I'm having trouble sending the email right now. Please try again in a moment.";

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 500 }
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to send email: ${errorMessage}`,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('[CONFIRM-EMAIL] ❌ Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm email',
      },
      { status: 500 }
    );
  }
}




