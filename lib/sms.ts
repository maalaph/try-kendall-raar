/**
 * SMS sending utilities using Twilio
 */

/**
 * Format phone number to E.164 format (e.g., +1XXXXXXXXXX)
 * Reuses logic from lib/vapi.ts for consistency
 */
function formatPhoneNumberToE164(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  
  let cleaned = trimmed;
  
  // If it already starts with +, validate it's properly formatted
  if (cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `+${digits}`;
    }
    return null;
  }
  
  // If no + prefix, extract only digits
  const digits = cleaned.replace(/\D/g, '');
  
  // Must have at least 10 digits
  if (digits.length < 10) {
    return null;
  }
  
  // If it's exactly 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, assume US number
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // For other lengths, assume first 1-3 digits are country code
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Default: assume US number if ambiguous
  return `+1${digits}`;
}

/**
 * Send SMS via Twilio
 * @param to - Recipient phone number (will be formatted to E.164)
 * @param message - SMS message content
 * @param from - Sender phone number (the assistant's phone number, will be formatted to E.164)
 * @returns Promise with success status and message SID if successful
 */
export async function sendSMS(to: string, message: string, from: string): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!twilioAccountSid || !twilioAuthToken) {
      const error = 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required';
      console.error('[SMS ERROR]', error);
      return { success: false, error };
    }
    
    // Format phone number to E.164
    const formattedTo = formatPhoneNumberToE164(to);
    if (!formattedTo) {
      const error = `Invalid phone number format: ${to}`;
      console.error('[SMS ERROR]', error);
      return { success: false, error };
    }
    
    // Format sender phone number to E.164
    const formattedFrom = formatPhoneNumberToE164(from);
    if (!formattedFrom) {
      const error = `Invalid sender phone number format: ${from}`;
      console.error('[SMS ERROR]', error);
      return { success: false, error };
    }
    
    // Send SMS via Twilio API
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: formattedFrom,
        To: formattedTo,
        Body: message,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Twilio API error: ${response.status} ${response.statusText}`;
      console.error('[SMS ERROR] Failed to send SMS:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        to: formattedTo,
      });
      return { success: false, error: errorMessage };
    }
    
    const data = await response.json();
    console.log('[SMS SUCCESS] SMS sent successfully:', {
      to: formattedTo,
      from: formattedFrom,
      messageSid: data.sid,
    });
    
    return { success: true, messageSid: data.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[SMS ERROR] Exception while sending SMS:', error);
    return { success: false, error: errorMessage };
  }
}

