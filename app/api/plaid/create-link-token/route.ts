import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid/client';
import { cookies } from 'next/headers';

/**
 * Create Plaid Link token for frontend
 * GET /api/plaid/create-link-token?recordId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get webhook URL from environment (if set)
    // Only use webhook in production/development, not sandbox
    let webhookUrl: string | undefined;
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    
    if (plaidEnv !== 'sandbox' && process.env.PLAID_WEBHOOK_URL) {
      webhookUrl = process.env.PLAID_WEBHOOK_URL;
    } else if (plaidEnv !== 'sandbox' && process.env.VAPI_WEBHOOK_URL) {
      // Construct webhook URL from VAPI webhook base
      const baseUrl = process.env.VAPI_WEBHOOK_URL.replace('/api/vapi-webhook', '');
      webhookUrl = `${baseUrl}/api/plaid/webhook`;
    }

    // Create link token
    const linkToken = await createLinkToken(recordId, webhookUrl);

    return NextResponse.json({
      link_token: linkToken,
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    });
  } catch (error: any) {
    console.error('[PLAID] Failed to create link token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}

