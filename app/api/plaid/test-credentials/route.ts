import { NextRequest, NextResponse } from 'next/server';

/**
 * Test Plaid credentials using a simpler endpoint
 * GET /api/plaid/test-credentials
 * 
 * This uses the /institutions/get endpoint which doesn't require products
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.PLAID_CLIENT_ID?.trim();
    const secret = process.env.PLAID_SECRET?.trim();
    const env = process.env.PLAID_ENV || 'sandbox';

    if (!clientId || !secret) {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 });
    }

    const baseUrl = env === 'sandbox' 
      ? 'https://sandbox.plaid.com'
      : env === 'development'
      ? 'https://development.plaid.com'
      : 'https://production.plaid.com';

    console.log('[PLAID TEST] Testing credentials with institutions/get endpoint');

    // Test with a simpler endpoint that just requires auth, not products
    // This will tell us if the credentials themselves are valid
    const response = await fetch(`${baseUrl}/institutions/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
      body: JSON.stringify({
        count: 1,
        offset: 0,
        country_codes: ['US'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[PLAID TEST] Institutions request failed:', data);
      return NextResponse.json({
        success: false,
        error: data.error_message || 'Request failed',
        error_code: data.error_code,
        error_type: data.error_type,
        details: data,
        message: 'Credentials failed validation - they may be invalid or for wrong environment',
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials are VALID and working!',
      institution_count: data.institutions?.length || 0,
      total_count: data.total || 0,
    });
  } catch (error: any) {
    console.error('[PLAID TEST] Credentials test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}

