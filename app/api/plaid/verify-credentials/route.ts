import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify Plaid credentials format and content
 * GET /api/plaid/verify-credentials
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const env = process.env.PLAID_ENV || 'sandbox';

    // Expected values from Plaid Dashboard
    const expectedClientId = '6936543513f9fbf00216fb86c';
    const expectedSecret = '429dfc6dc3d8f652cdada31ba654d7';

    // Analyze the actual credentials
    const clientIdAnalysis = {
      raw: clientId,
      trimmed: clientId?.trim(),
      length: clientId?.length,
      trimmedLength: clientId?.trim().length,
      hasQuotes: clientId?.startsWith('"') || clientId?.startsWith("'") || clientId?.endsWith('"') || clientId?.endsWith("'"),
      hasSpaces: clientId?.includes(' ') && !clientId?.trim() === clientId,
      charCodes: clientId?.split('').map((c, i) => ({
        pos: i,
        char: c,
        code: c.charCodeAt(0),
        isPrintable: c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126,
      })).slice(0, 30),
      matchesExpected: clientId?.trim() === expectedClientId,
      first10: clientId?.substring(0, 10),
      last10: clientId?.substring(Math.max(0, (clientId?.length || 0) - 10)),
    };

    const secretAnalysis = {
      raw: secret,
      trimmed: secret?.trim(),
      length: secret?.length,
      trimmedLength: secret?.trim().length,
      hasQuotes: secret?.startsWith('"') || secret?.startsWith("'") || secret?.endsWith('"') || secret?.endsWith("'"),
      hasSpaces: secret?.includes(' ') && !secret?.trim() === secret,
      charCodes: secret?.split('').map((c, i) => ({
        pos: i,
        char: c,
        code: c.charCodeAt(0),
        isPrintable: c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126,
      })).slice(0, 30),
      matchesExpected: secret?.trim() === expectedSecret,
      first10: secret?.substring(0, 10),
      last10: secret?.substring(Math.max(0, (secret?.length || 0) - 10)),
    };

    return NextResponse.json({
      env,
      credentials_present: {
        client_id: !!clientId,
        secret: !!secret,
      },
      expected_values: {
        client_id: expectedClientId,
        secret: expectedSecret.substring(0, 10) + '...' + expectedSecret.substring(expectedSecret.length - 5),
      },
      client_id_analysis: {
        ...clientIdAnalysis,
        raw: clientIdAnalysis.raw ? '[REDACTED - length: ' + clientIdAnalysis.length + ']' : null,
      },
      secret_analysis: {
        ...secretAnalysis,
        raw: secretAnalysis.raw ? '[REDACTED - length: ' + secretAnalysis.length + ']' : null,
      },
      recommendations: [
        clientIdAnalysis.hasQuotes && '⚠️ Client ID appears to have quotes - remove them',
        secretAnalysis.hasQuotes && '⚠️ Secret appears to have quotes - remove them',
        clientIdAnalysis.hasSpaces && '⚠️ Client ID has spaces - ensure no spaces',
        secretAnalysis.hasSpaces && '⚠️ Secret has spaces - ensure no spaces',
        !clientIdAnalysis.matchesExpected && '❌ Client ID does not match expected value from Plaid Dashboard',
        !secretAnalysis.matchesExpected && '❌ Secret does not match expected value from Plaid Dashboard',
        clientIdAnalysis.trimmedLength !== 25 && `❌ Client ID should be 25 characters, got ${clientIdAnalysis.trimmedLength}`,
        secretAnalysis.trimmedLength !== 30 && `❌ Secret should be 30 characters, got ${secretAnalysis.trimmedLength}`,
      ].filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}

