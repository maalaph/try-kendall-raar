/**
 * Incoming Webhooks Handler
 * Single entry point for external webhooks (Gmail, Calendar, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('WEBHOOKS');

export interface WebhookPayload {
  source: 'gmail' | 'calendar' | 'spotify' | 'stripe' | 'custom';
  event: string;
  data: Record<string, any>;
  timestamp?: string;
  userId?: string;
}

/**
 * POST /api/webhooks/incoming
 * Handle incoming webhooks from external services
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.forRequest(requestId);
  
  try {
    // Get webhook source from headers or query
    const source = request.headers.get('x-webhook-source') ||
                   request.nextUrl.searchParams.get('source') ||
                   'custom';
    
    log.info('Incoming webhook', { source });
    
    // Parse body
    let payload: any;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await request.text();
    }
    
    // Route to appropriate handler
    let result;
    switch (source) {
      case 'gmail':
        result = await handleGmailWebhook(payload, log);
        break;
      case 'calendar':
        result = await handleCalendarWebhook(payload, log);
        break;
      case 'spotify':
        result = await handleSpotifyWebhook(payload, log);
        break;
      case 'stripe':
        result = await handleStripeWebhook(payload, request, log);
        break;
      default:
        result = await handleCustomWebhook(payload, source, log);
    }
    
    log.info('Webhook processed', { source, success: result.success });
    
    return NextResponse.json({
      success: result.success,
      message: result.message || 'Webhook received',
      requestId,
    });
  } catch (error) {
    log.error('Webhook processing failed', error);
    
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        requestId,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/incoming
 * Verification endpoint for webhook setup (some services require this)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Handle Google webhook verification
  const hubChallenge = searchParams.get('hub.challenge');
  if (hubChallenge) {
    return new NextResponse(hubChallenge, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  
  // Handle other verification methods
  const verifyToken = searchParams.get('verify_token');
  if (verifyToken === process.env.WEBHOOK_VERIFY_TOKEN) {
    const challenge = searchParams.get('challenge');
    if (challenge) {
      return NextResponse.json({ challenge });
    }
    return NextResponse.json({ status: 'verified' });
  }
  
  return NextResponse.json({ status: 'Webhook endpoint active' });
}

/**
 * Handle Gmail push notifications
 */
async function handleGmailWebhook(
  payload: any,
  log: ReturnType<typeof createLogger>
): Promise<{ success: boolean; message?: string }> {
  try {
    // Gmail push notification structure
    const message = payload.message;
    if (!message) {
      log.warn('Gmail webhook: No message in payload');
      return { success: true, message: 'No message to process' };
    }
    
    // Decode the base64 data
    const data = message.data ? JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    ) : null;
    
    log.info('Gmail notification received', {
      historyId: data?.historyId,
      emailAddress: data?.emailAddress,
    });
    
    // TODO: Process Gmail notification
    // - Fetch new messages
    // - Trigger agent if needed
    
    return { success: true, message: 'Gmail notification processed' };
  } catch (error) {
    log.error('Gmail webhook handler error', error);
    return { success: false, message: 'Failed to process Gmail notification' };
  }
}

/**
 * Handle Google Calendar push notifications
 */
async function handleCalendarWebhook(
  payload: any,
  log: ReturnType<typeof createLogger>
): Promise<{ success: boolean; message?: string }> {
  try {
    log.info('Calendar notification received', {
      resourceId: payload.resourceId,
      channelId: payload.channelId,
    });
    
    // TODO: Process calendar notification
    // - Fetch updated events
    // - Sync to local database
    // - Notify user if needed
    
    return { success: true, message: 'Calendar notification processed' };
  } catch (error) {
    log.error('Calendar webhook handler error', error);
    return { success: false, message: 'Failed to process calendar notification' };
  }
}

/**
 * Handle Spotify webhooks
 */
async function handleSpotifyWebhook(
  payload: any,
  log: ReturnType<typeof createLogger>
): Promise<{ success: boolean; message?: string }> {
  try {
    log.info('Spotify notification received', {
      event: payload.event,
    });
    
    // TODO: Process Spotify notification
    
    return { success: true, message: 'Spotify notification processed' };
  } catch (error) {
    log.error('Spotify webhook handler error', error);
    return { success: false, message: 'Failed to process Spotify notification' };
  }
}

/**
 * Handle Stripe webhooks (for future payment integration)
 */
async function handleStripeWebhook(
  payload: any,
  request: NextRequest,
  log: ReturnType<typeof createLogger>
): Promise<{ success: boolean; message?: string }> {
  try {
    // Verify Stripe signature
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      log.warn('Stripe webhook: Missing signature');
      return { success: false, message: 'Missing signature' };
    }
    
    // TODO: Verify with Stripe SDK
    // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    log.info('Stripe event received', {
      type: payload.type,
      id: payload.id,
    });
    
    // Handle different event types
    switch (payload.type) {
      case 'checkout.session.completed':
        // Handle successful payment
        break;
      case 'customer.subscription.updated':
        // Handle subscription change
        break;
      case 'invoice.payment_failed':
        // Handle failed payment
        break;
    }
    
    return { success: true, message: 'Stripe event processed' };
  } catch (error) {
    log.error('Stripe webhook handler error', error);
    return { success: false, message: 'Failed to process Stripe event' };
  }
}

/**
 * Handle custom/unknown webhooks
 */
async function handleCustomWebhook(
  payload: any,
  source: string,
  log: ReturnType<typeof createLogger>
): Promise<{ success: boolean; message?: string }> {
  log.info('Custom webhook received', {
    source,
    payloadKeys: Object.keys(payload || {}),
  });
  
  // Store for debugging/analysis
  // TODO: Store in database if needed
  
  return { success: true, message: `Custom webhook from ${source} received` };
}



