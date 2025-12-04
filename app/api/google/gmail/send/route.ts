import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleIntegrationError,
  sendGmailMessage,
} from '@/lib/integrations/google';

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const recordId =
      body.recordId || request.nextUrl.searchParams.get('recordId');
    const to = body.to || request.nextUrl.searchParams.get('to');
    const subject =
      body.subject || request.nextUrl.searchParams.get('subject') || '';
    const emailBody =
      body.body || request.nextUrl.searchParams.get('body') || '';

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 },
      );
    }

    if (!to) {
      return NextResponse.json(
        { error: 'to parameter (recipient email) is required' },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 },
      );
    }

    const { messageId } = await sendGmailMessage(recordId, {
      to,
      subject,
      body: emailBody,
    });

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Email sent successfully',
    });
  } catch (error) {
    if (error instanceof GoogleIntegrationError) {
      const status =
        error.reason === 'NOT_CONNECTED' || error.reason === 'TOKEN_REFRESH_FAILED'
          ? 401
          : error.reason === 'INSUFFICIENT_PERMISSIONS'
          ? 403
          : 500;
      const message =
        error.reason === 'NOT_CONNECTED'
          ? 'Please connect your Google account in the Integrations page.'
          : error.reason === 'TOKEN_REFRESH_FAILED'
          ? 'Your Google account connection may have expired. Please reconnect your Google account in the Integrations page.'
          : error.reason === 'INSUFFICIENT_PERMISSIONS'
          ? 'Your Google account is connected but missing Gmail send permissions. Please reconnect Google and grant email access.'
          : error.message;

      return NextResponse.json(
        {
          error: error.message,
          message,
        },
        { status },
      );
    }

    console.error('[GOOGLE GMAIL SEND] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send email',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while sending email',
      },
      { status: 500 },
    );
  }
}


