import { NextRequest, NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/google/api';

export async function POST(request: NextRequest) {
  let body: any = {};
  let recordId: string | null = null;
  
  try {
    try {
      body = await request.json();
    } catch {
      // Fallback to query params if body parsing fails
      body = {};
    }
    
    recordId = body.recordId || request.nextUrl.searchParams.get('recordId');
    const to = body.to || request.nextUrl.searchParams.get('to');
    const subject = body.subject || request.nextUrl.searchParams.get('subject') || '';
    const emailBody = body.body || request.nextUrl.searchParams.get('body') || '';
    
    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        { error: 'to parameter (recipient email) is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    // Get authenticated Gmail client
    const gmail = await getGmailClient(recordId);

    // Create email message
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody,
    ].join('\n');

    // Encode message in base64url format (Gmail API requirement)
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: response.data.id,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    // Use recordId that was extracted earlier (or try to get from query params)
    const errorRecordId = recordId || request.nextUrl.searchParams.get('recordId');
    
    console.error('[GOOGLE GMAIL SEND] Error sending email:', {
      error: error.message,
      stack: error.stack,
      recordId: errorRecordId,
    });
    
    // Check for specific error types
    if (error.message?.includes('not connected') || error.message?.includes('Google account not connected')) {
      return NextResponse.json(
        { 
          error: 'Google account not connected',
          message: 'Please connect your Google account in the Integrations page.',
        },
        { status: 401 }
      );
    }
    
    // Check for token refresh errors
    if (error.message?.includes('Failed to refresh access token') || error.message?.includes('refresh token')) {
      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          message: 'Your Google account connection may have expired. Please reconnect your Google account in the Integrations page.',
        },
        { status: 401 }
      );
    }

    // Generic API error
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        message: error.message || 'Unknown error occurred while sending email',
      },
      { status: 500 }
    );
  }
}

