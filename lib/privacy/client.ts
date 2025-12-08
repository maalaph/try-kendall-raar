/**
 * Privacy.com API Client
 * Handles virtual card creation and management
 * 
 * MOCK MODE: When PRIVACY_API_KEY is not set, returns mock data for testing
 */

import type { PrivacyCard, CreateCardParams, PrivacyCardResponse, PrivacyAPIResponse } from './types';

const PRIVACY_API_BASE = 'https://api.privacy.com/v1';
const MOCK_MODE = !process.env.PRIVACY_API_KEY;

/**
 * Get Privacy.com API key from environment
 */
function getApiKey(): string {
  const key = process.env.PRIVACY_API_KEY;
  if (!key && !MOCK_MODE) {
    throw new Error('PRIVACY_API_KEY environment variable is required');
  }
  return key || 'mock-key';
}

/**
 * Make API request to Privacy.com
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<PrivacyAPIResponse<T>> {
  if (MOCK_MODE) {
    console.log('[PRIVACY MOCK] Mocking API request to:', endpoint);
    return mockApiResponse<T>(endpoint, options);
  }

  const apiKey = getApiKey();
  const url = `${PRIVACY_API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `api-key ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: {
          code: String(response.status),
          message: errorData.message || `HTTP ${response.status}`,
          request_id: errorData.request_id,
        },
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('[PRIVACY] API request failed:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Mock API responses for testing (when PRIVACY_API_KEY not set)
 */
function mockApiResponse<T>(endpoint: string, options: RequestInit): PrivacyAPIResponse<T> {
  // Simulate network delay
  const delay = Math.random() * 200 + 100;
  
  if (endpoint === '/card' && options.method === 'POST') {
    const body = JSON.parse((options.body as string) || '{}');
    const mockCard: PrivacyCard = {
      token: `mock_card_${Date.now()}`,
      type: body.type || 'MERCHANT_LOCKED',
      state: 'OPEN',
      funding: {
        token: 'mock_funding_token',
        state: 'OPEN',
        type: 'DEPOSITORY_CHECKING',
        created: new Date().toISOString(),
        last_four: '1234',
        network: 'VISA',
        expires_after: null,
      },
      memo: body.memo,
      spend_limit: body.spend_limit || null,
      spend_limit_duration: body.spend_limit_duration || null,
      created: new Date().toISOString(),
      last_four: String(Math.floor(Math.random() * 9000) + 1000),
      hostname: body.hostname || null,
    };

    return {
      data: {
        card: mockCard,
      } as T,
    };
  }

  if (endpoint.startsWith('/card/') && options.method === 'GET') {
    const cardId = endpoint.split('/')[2];
    const mockCard: PrivacyCard = {
      token: cardId,
      type: 'MERCHANT_LOCKED',
      state: 'OPEN',
      funding: {
        token: 'mock_funding_token',
        state: 'OPEN',
        type: 'DEPOSITORY_CHECKING',
        created: new Date().toISOString(),
        last_four: '1234',
        network: 'VISA',
        expires_after: null,
      },
      created: new Date().toISOString(),
      last_four: String(Math.floor(Math.random() * 9000) + 1000),
    };

    return {
      data: {
        card: mockCard,
      } as T,
    };
  }

  return {
    error: {
      code: 'NOT_IMPLEMENTED',
      message: `Mock endpoint not implemented: ${endpoint}`,
    },
  };
}

/**
 * Create a new virtual card
 */
export async function createVirtualCard(
  params: CreateCardParams
): Promise<PrivacyAPIResponse<PrivacyCardResponse>> {
  if (MOCK_MODE) {
    console.log('[PRIVACY MOCK] Creating mock virtual card:', params);
  }

  return apiRequest<PrivacyCardResponse>('/card', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get card details
 */
export async function getCard(cardToken: string): Promise<PrivacyAPIResponse<PrivacyCardResponse>> {
  return apiRequest<PrivacyCardResponse>(`/card/${cardToken}`, {
    method: 'GET',
  });
}

/**
 * Update card (pause, unpause, close)
 */
export async function updateCard(
  cardToken: string,
  state: 'OPEN' | 'PAUSED' | 'CLOSED'
): Promise<PrivacyAPIResponse<PrivacyCardResponse>> {
  return apiRequest<PrivacyCardResponse>(`/card/${cardToken}`, {
    method: 'PUT',
    body: JSON.stringify({ state }),
  });
}

/**
 * List all cards (with pagination)
 */
export async function listCards(options?: {
  page?: number;
  page_size?: number;
}): Promise<PrivacyAPIResponse<{ cards: PrivacyCard[] }>> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.page_size) params.append('page_size', String(options.page_size));

  const query = params.toString();
  return apiRequest<{ cards: PrivacyCard[] }>(`/card${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Check if Privacy.com is available (not in mock mode)
 */
export function isPrivacyAvailable(): boolean {
  return !MOCK_MODE;
}

