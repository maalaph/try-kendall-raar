import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to directly call Plaid API with fetch
 * This helps verify if credentials work outside the SDK
 * GET /api/plaid/test-direct?recordId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    if (!recordId) {
      return NextResponse.json({ error: 'recordId required' }, { status: 400 });
    }

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

    // Validate and clean credentials - remove any non-printable characters
    const cleanClientId = clientId.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
    const cleanSecret = secret.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

    // Log detailed credential info (first/last chars for debugging)
    console.log('[PLAID TEST] Credential validation:', {
      baseUrl,
      clientIdLength: cleanClientId.length,
      secretLength: cleanSecret.length,
      clientIdFirst5: cleanClientId.substring(0, 5),
      clientIdLast5: cleanClientId.substring(Math.max(0, cleanClientId.length - 5)),
      secretFirst5: cleanSecret.substring(0, 5),
      secretLast5: cleanSecret.substring(Math.max(0, cleanSecret.length - 5)),
      clientIdBytes: Array.from(cleanClientId).map(c => c.charCodeAt(0)).slice(0, 10),
      isAlphanumericClientId: /^[a-zA-Z0-9]+$/.test(cleanClientId),
      isAlphanumericSecret: /^[a-zA-Z0-9]+$/.test(cleanSecret),
    });

    // Verify credentials match expected format from Plaid Dashboard
    // Expected: Client ID should be 25 chars hex, Secret should be 30 chars hex
    if (cleanClientId.length !== 25) {
      return NextResponse.json({
        error: `Invalid Client ID length: expected 25, got ${cleanClientId.length}`,
        clientIdLength: cleanClientId.length,
      }, { status: 500 });
    }

    if (cleanSecret.length !== 30) {
      return NextResponse.json({
        error: `Invalid Secret length: expected 30, got ${cleanSecret.length}`,
        secretLength: cleanSecret.length,
      }, { status: 500 });
    }

    // Prepare request body
    const requestBody = {
      client_name: 'Kendall AI Assistant',
      user: {
        client_user_id: recordId,
      },
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    };

    // Log exact request details (sanitized)
    console.log('[PLAID TEST] Request details:', {
      url: `${baseUrl}/link/token/create`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': cleanClientId.substring(0, 5) + '...' + cleanClientId.substring(cleanClientId.length - 3),
        'PLAID-SECRET': cleanSecret.substring(0, 5) + '...' + cleanSecret.substring(cleanSecret.length - 3),
        'PLAID-CLIENT-ID-length': cleanClientId.length,
        'PLAID-SECRET-length': cleanSecret.length,
      },
      body: requestBody,
    });

    // Direct fetch request to Plaid API
    const response = await fetch(`${baseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': cleanClientId,
        'PLAID-SECRET': cleanSecret,
      },
      body: JSON.stringify(requestBody),
    });

    // Log response details
    console.log('[PLAID TEST] Response status:', response.status);
    console.log('[PLAID TEST] Response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    
    console.log('[PLAID TEST] Response data:', data);

    if (!response.ok) {
      console.error('[PLAID TEST] Request failed:', data);
      return NextResponse.json(
        {
          error: data.error_message || 'Request failed',
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      link_token: data.link_token,
      message: 'Direct API call succeeded - credentials work!',
    });
  } catch (error: any) {
    console.error('[PLAID TEST] Direct request failed:', error);
    return NextResponse.json(
      {
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

