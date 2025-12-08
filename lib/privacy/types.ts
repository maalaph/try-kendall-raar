/**
 * Privacy.com API Types
 * Type definitions for Privacy.com virtual card API
 */

export interface PrivacyCard {
  token: string;
  type: 'SINGLE_USE' | 'MERCHANT_LOCKED' | 'OPEN';
  state: 'OPEN' | 'PAUSED' | 'CLOSED' | 'PENDING_FULFILLMENT' | 'PENDING_ACTIVATION';
  funding: {
    token: string;
    state: string;
    type: string;
    created: string;
    last_four: string;
    network: string;
    expires_after: number | null;
  };
  memo?: string;
  spend_limit?: number; // Amount in cents
  spend_limit_duration?: 'ANNUALLY' | 'FOREVER' | 'MONTHLY' | 'TRANSACTION';
  created: string;
  last_four: string;
  hostname?: string; // For merchant-locked cards
}

export interface CreateCardParams {
  type?: 'SINGLE_USE' | 'MERCHANT_LOCKED' | 'OPEN';
  memo?: string;
  spend_limit?: number; // Amount in cents
  spend_limit_duration?: 'ANNUALLY' | 'FOREVER' | 'MONTHLY' | 'TRANSACTION';
  funding_token?: string; // Funding source token
  hostname?: string; // For merchant-locked cards (required if type is MERCHANT_LOCKED)
}

export interface PrivacyCardResponse {
  card: PrivacyCard;
}

export interface PrivacyError {
  code: string;
  message: string;
  request_id?: string;
}

export interface PrivacyAPIResponse<T> {
  data?: T;
  error?: PrivacyError;
}

