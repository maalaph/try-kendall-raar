/**
 * Plaid API Client
 * Wrapper around Plaid SDK for bank account connections
 */

import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';

// Initialize Plaid client based on environment
let plaidClient: PlaidApi | null = null;
let cachedEnv: string | null = null;
let cachedClientId: string | null = null;

export function getPlaidClient(): PlaidApi {
  const currentEnv = process.env.PLAID_ENV || 'sandbox';
  const currentClientId = process.env.PLAID_CLIENT_ID?.trim() || '';
  
  // Clear cache if environment or credentials have changed
  if (plaidClient && (cachedEnv !== currentEnv || cachedClientId !== currentClientId)) {
    console.log('[PLAID] Clearing cached client due to configuration change');
    plaidClient = null;
    cachedEnv = null;
    cachedClientId = null;
  }
  
  // Return cached client if it exists and credentials haven't changed
  if (plaidClient) {
    return plaidClient;
  }

  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  const env = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production';

  if (!clientId || !secret) {
    throw new Error('Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
  }

  // Validate credential format
  if (clientId.length < 10) {
    throw new Error(`Invalid PLAID_CLIENT_ID: appears to be incomplete (length: ${clientId.length}). Please check your .env.local file.`);
  }
  if (secret.length < 10) {
    throw new Error(`Invalid PLAID_SECRET: appears to be incomplete (length: ${secret.length}). Please check your .env.local file.`);
  }

  // Debug logging (remove sensitive data in production)
  console.log('[PLAID] Initializing client:', {
    env,
    clientIdLength: clientId.length,
    secretLength: secret.length,
    clientIdPrefix: clientId.substring(0, 5),
    clientIdSuffix: clientId.substring(clientId.length - 3),
  });

  // Ensure credentials are strings (explicit type checking and validation)
  // Remove any potential newlines, carriage returns, or other whitespace
  const clientIdStr = String(clientId).trim().replace(/[\r\n\t]/g, '');
  const secretStr = String(secret).trim().replace(/[\r\n\t]/g, '');

  // Verify they're not empty after conversion
  if (!clientIdStr || !secretStr) {
    throw new Error('Plaid credentials are empty after processing. Check your environment variables.');
  }

  // Verify they're valid strings (not "undefined" or "null" as strings)
  if (clientIdStr === 'undefined' || clientIdStr === 'null' || secretStr === 'undefined' || secretStr === 'null') {
    throw new Error('Plaid credentials appear to be undefined or null. Check your environment variables.');
  }

  // Additional validation: ensure credentials match expected format
  // Plaid sandbox credentials should be alphanumeric hex strings
  if (!/^[a-f0-9]+$/i.test(clientIdStr)) {
    console.warn('[PLAID] Client ID contains non-hex characters. Expected format: hex string');
    console.warn('[PLAID] Client ID characters:', Array.from(clientIdStr).map(c => `${c} (${c.charCodeAt(0)})`).join(', '));
  }
  
  if (!/^[a-f0-9]+$/i.test(secretStr)) {
    console.warn('[PLAID] Secret contains non-hex characters. Expected format: hex string');
  }

  // Create headers object as a completely fresh object to avoid any prototype issues
  // Ensure values are explicitly strings with no extra characters
  const headers: Record<string, string> = {};
  headers['PLAID-CLIENT-ID'] = clientIdStr;
  headers['PLAID-SECRET'] = secretStr;

  // Verify header values are actually strings and not empty
  if (typeof headers['PLAID-CLIENT-ID'] !== 'string' || headers['PLAID-CLIENT-ID'].length === 0) {
    throw new Error('PLAID_CLIENT_ID is not a valid string');
  }
  if (typeof headers['PLAID-SECRET'] !== 'string' || headers['PLAID-SECRET'].length === 0) {
    throw new Error('PLAID_SECRET is not a valid string');
  }

  // Create configuration with explicit header setup
  // Plaid SDK v40 requires headers to be set in baseOptions
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: { ...headers }, // Spread to create a new object
    },
  });

  // Debug: Log configuration details (sanitized)
  console.log('[PLAID] Configuration created:', {
    basePath: configuration.basePath,
    hasHeaders: !!configuration.baseOptions?.headers,
    headerKeys: configuration.baseOptions?.headers ? Object.keys(configuration.baseOptions.headers) : [],
    clientIdHeaderPresent: !!configuration.baseOptions?.headers?.['PLAID-CLIENT-ID'],
    secretHeaderPresent: !!configuration.baseOptions?.headers?.['PLAID-SECRET'],
    clientIdHeaderLength: configuration.baseOptions?.headers?.['PLAID-CLIENT-ID']?.length || 0,
    secretHeaderLength: configuration.baseOptions?.headers?.['PLAID-SECRET']?.length || 0,
  });

  plaidClient = new PlaidApi(configuration);
  
  // Try to access the underlying Axios instance to verify headers
  // Note: This is for debugging only - Plaid SDK uses Axios internally
  try {
    // @ts-ignore - accessing internal SDK structure for debugging
    const axiosInstance = (plaidClient as any).configuration?.apiKey;
    if (axiosInstance) {
      console.log('[PLAID] Axios instance found');
    }
  } catch (e) {
    // Ignore - we're just trying to debug
  }
  
  // Cache the configuration used
  cachedEnv = env;
  cachedClientId = clientIdStr;
  
  return plaidClient;
}

/**
 * Create a Link token for Plaid Link frontend
 */
export async function createLinkToken(
  userId: string,
  webhookUrl?: string
): Promise<string> {
  const client = getPlaidClient();

  const request = {
    user: {
      client_user_id: userId, // Unique identifier for the user
    },
    client_name: 'Kendall AI Assistant',
    products: [Products.Transactions], // Products we need access to (Auth not enabled in Plaid account)
    country_codes: [CountryCode.Us],
    language: 'en',
    ...(webhookUrl && { webhook: webhookUrl }), // Optional webhook URL
  };

  console.log('[PLAID] Creating link token with request:', JSON.stringify({
    ...request,
    user: { client_user_id: request.user.client_user_id },
  }, null, 2));

  // Log the client configuration to verify headers
  const clientConfig = (client as any).configuration;
  if (clientConfig) {
    console.log('[PLAID] Client config headers:', {
      hasBaseOptions: !!clientConfig.baseOptions,
      hasHeaders: !!clientConfig.baseOptions?.headers,
      headerKeys: clientConfig.baseOptions?.headers ? Object.keys(clientConfig.baseOptions.headers) : [],
      clientIdInHeaders: !!clientConfig.baseOptions?.headers?.['PLAID-CLIENT-ID'],
    });
  }

  try {
    const response = await client.linkTokenCreate(request);
    return response.data.link_token;
  } catch (error: any) {
    console.error('[PLAID] Failed to create link token:', error);
    
    // Log detailed error information from Plaid
    if (error.response?.data) {
      console.error('[PLAID] Error details:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('[PLAID] Status:', error.response.status);
    }
    
    const errorMessage = error.response?.data?.error_message || 
                         error.response?.data?.display_message ||
                         error.message || 
                         'Unknown error';
    throw new Error(`Failed to create Plaid link token: ${errorMessage}`);
  }
}

/**
 * Exchange public token for access token
 */
export async function exchangePublicToken(publicToken: string): Promise<{
  access_token: string;
  item_id: string;
}> {
  const client = getPlaidClient();

  try {
    const response = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    };
  } catch (error: any) {
    console.error('[PLAID] Failed to exchange public token:', error);
    throw new Error(`Failed to exchange public token: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get accounts for an item
 */
export async function getAccounts(accessToken: string) {
  const client = getPlaidClient();

  try {
    const response = await client.accountsGet({
      access_token: accessToken,
    });

    return {
      accounts: response.data.accounts,
      item: response.data.item,
    };
  } catch (error: any) {
    console.error('[PLAID] Failed to get accounts:', error);
    throw new Error(`Failed to get accounts: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get institution information
 */
export async function getInstitution(institutionId: string) {
  const client = getPlaidClient();

  try {
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    return response.data.institution;
  } catch (error: any) {
    console.error('[PLAID] Failed to get institution:', error);
    throw new Error(`Failed to get institution: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Sync transactions for an item
 * Returns transactions and cursor for pagination
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string
): Promise<{
  transactions: any[];
  cursor: string | null;
  has_more: boolean;
}> {
  const client = getPlaidClient();

  try {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor: cursor,
    });

    return {
      transactions: response.data.added || [],
      cursor: response.data.next_cursor || null,
      has_more: response.data.has_more || false,
    };
  } catch (error: any) {
    console.error('[PLAID] Failed to sync transactions:', error);
    throw new Error(`Failed to sync transactions: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get transaction count for an item (for initial sync)
 */
export async function getTransactionCount(accessToken: string, startDate: string, endDate: string): Promise<number> {
  const client = getPlaidClient();

  try {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      count: 1, // Just get count, not actual transactions
    });

    return response.data.total_transactions || 0;
  } catch (error: any) {
    console.error('[PLAID] Failed to get transaction count:', error);
    return 0;
  }
}

/**
 * Remove a Plaid item (disconnect bank account)
 * This revokes the access token with Plaid
 */
export async function removeItem(accessToken: string): Promise<void> {
  const client = getPlaidClient();

  try {
    await client.itemRemove({
      access_token: accessToken,
    });
    console.log('[PLAID] Successfully removed item from Plaid');
  } catch (error: any) {
    console.error('[PLAID] Failed to remove item:', error);
    throw new Error(`Failed to remove Plaid item: ${error.message || 'Unknown error'}`);
  }
}

