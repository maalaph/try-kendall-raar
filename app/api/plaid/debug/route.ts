import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check Plaid credentials (without exposing secrets)
 * GET /api/plaid/debug
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const env = process.env.PLAID_ENV || 'sandbox';

    return NextResponse.json({
      credentials_present: {
        client_id: !!clientId,
        secret: !!secret,
        env: !!env,
      },
      credential_info: {
        client_id_length: clientId?.length || 0,
        secret_length: secret?.length || 0,
        env: env,
        client_id_first_5: clientId?.substring(0, 5) || null,
        client_id_last_3: clientId?.substring(Math.max(0, (clientId?.length || 0) - 3)) || null,
      },
      has_whitespace: {
        client_id_has_leading_space: clientId?.startsWith(' ') || false,
        client_id_has_trailing_space: clientId?.endsWith(' ') || false,
        secret_has_leading_space: secret?.startsWith(' ') || false,
        secret_has_trailing_space: secret?.endsWith(' ') || false,
      },
      trimmed: {
        client_id_length_trimmed: clientId?.trim().length || 0,
        secret_length_trimmed: secret?.trim().length || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

