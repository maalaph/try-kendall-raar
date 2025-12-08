/**
 * Purchase Processor
 * Handles purchase workflow: approval → card creation → execution
 */

import { createVirtualCard, getCard, updateCard } from '../privacy/client';
import { createApprovalRequest, getApprovalById, resolveApproval } from '../agent/approvalHandler';
import { supabase } from '../supabase';

export interface PurchaseItem {
  name: string;
  url?: string;
  merchant: string;
  amount: number; // Amount in cents
  currency?: string;
}

export interface CreatePurchaseParams {
  userId: string;
  item: PurchaseItem;
  threadId?: string;
  context?: Record<string, any>;
}

export interface PurchaseRequest {
  id: string;
  userId: string;
  approvalId: string;
  item: PurchaseItem;
  status: 'pending_approval' | 'approved' | 'card_created' | 'purchased' | 'failed' | 'cancelled';
  virtualCardId?: string;
  createdAt: string;
}

/**
 * Create a purchase request and trigger approval workflow
 */
export async function initiatePurchase(
  params: CreatePurchaseParams
): Promise<PurchaseRequest> {
  const { userId, item, threadId, context } = params;

  // Step 1: Create approval request
  const approval = await createApprovalRequest({
    userId,
    actionType: 'purchase',
    actionParams: {
      item: item.name,
      merchant: item.merchant,
      amount: item.amount / 100, // Convert cents to dollars for display
      url: item.url,
    },
    message: `Purchase ${item.name} from ${item.merchant} for $${(item.amount / 100).toFixed(2)}`,
    context: {
      ...context,
      item,
      threadId,
    },
    threadId,
    expiresInHours: 24,
  });

  // Step 2: Create purchase request record
  const { data: purchaseRequest, error } = await supabase
    .from('purchase_requests')
    .insert({
      user_id: userId,
      approval_id: approval.id,
      item_name: item.name,
      item_url: item.url,
      merchant: item.merchant,
      amount: item.amount,
      currency: item.currency || 'USD',
      status: 'pending_approval',
      purchase_details: context || {},
    })
    .select('*')
    .single();

  if (error) {
    console.error('[PURCHASE] Failed to create purchase request:', error);
    throw new Error(`Failed to create purchase request: ${error.message}`);
  }

  console.log('[PURCHASE] Created purchase request:', {
    id: purchaseRequest.id,
    approvalId: approval.id,
    item: item.name,
  });

  return {
    id: purchaseRequest.id,
    userId,
    approvalId: approval.id,
    item,
    status: 'pending_approval',
    createdAt: purchaseRequest.created_at,
  };
}

/**
 * Process approved purchase: Create virtual card
 */
export async function processApprovedPurchase(
  purchaseRequestId: string
): Promise<{ cardToken: string; cardNumber: string }> {
  // Get purchase request
  const { data: purchaseRequest, error: fetchError } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('id', purchaseRequestId)
    .single();

  if (fetchError || !purchaseRequest) {
    throw new Error(`Purchase request not found: ${purchaseRequestId}`);
  }

  if (purchaseRequest.status !== 'approved') {
    throw new Error(`Purchase request is not approved: ${purchaseRequest.status}`);
  }

  // Step 1: Create virtual card with Privacy.com
  const cardResponse = await createVirtualCard({
    type: 'MERCHANT_LOCKED', // Lock card to first merchant
    memo: `Purchase: ${purchaseRequest.item_name}`,
    spend_limit: purchaseRequest.amount,
    spend_limit_duration: 'TRANSACTION',
    // Extract hostname from URL if provided
    hostname: purchaseRequest.item_url
      ? new URL(purchaseRequest.item_url).hostname.replace('www.', '')
      : undefined,
  });

  if (cardResponse.error || !cardResponse.data) {
    // Update purchase request status to failed
    await supabase
      .from('purchase_requests')
      .update({ status: 'failed' })
      .eq('id', purchaseRequestId);

    throw new Error(
      cardResponse.error?.message || 'Failed to create virtual card'
    );
  }

  const card = cardResponse.data.card;

  // Step 2: Save card to database
  const { data: virtualCard, error: cardError } = await supabase
    .from('virtual_cards')
    .insert({
      user_id: purchaseRequest.user_id,
      privacy_card_id: card.token,
      card_number: card.last_four,
      card_type: card.type.toLowerCase(),
      spend_limit: card.spend_limit || purchaseRequest.amount,
      spent_amount: 0,
      state: card.state,
      merchant: purchaseRequest.merchant,
      metadata: {
        memo: card.memo,
        created_for_purchase: purchaseRequest.id,
      },
    })
    .select('*')
    .single();

  if (cardError || !virtualCard) {
    console.error('[PURCHASE] Failed to save virtual card:', cardError);
    // Card was created in Privacy.com, but failed to save to DB
    // This is recoverable - we have the card token
  }

  // Step 3: Update purchase request with card
  await supabase
    .from('purchase_requests')
    .update({
      status: 'card_created',
      virtual_card_id: virtualCard?.id || null,
      purchase_details: {
        ...purchaseRequest.purchase_details,
        card_token: card.token,
        card_last_four: card.last_four,
      },
    })
    .eq('id', purchaseRequestId);

  console.log('[PURCHASE] Virtual card created:', {
    cardToken: card.token,
    lastFour: card.last_four,
    purchaseRequestId,
  });

  return {
    cardToken: card.token,
    cardNumber: card.last_four,
  };
}

/**
 * Mark purchase as completed (after actual purchase is made)
 */
export async function completePurchase(
  purchaseRequestId: string,
  transactionDetails?: Record<string, any>
): Promise<void> {
  const { data: purchaseRequest } = await supabase
    .from('purchase_requests')
    .select('*, virtual_cards(*)')
    .eq('id', purchaseRequestId)
    .single();

  if (!purchaseRequest) {
    throw new Error(`Purchase request not found: ${purchaseRequestId}`);
  }

  // Update purchase request
  await supabase
    .from('purchase_requests')
    .update({
      status: 'purchased',
      completed_at: new Date().toISOString(),
      purchase_details: {
        ...purchaseRequest.purchase_details,
        transaction_details: transactionDetails,
        completed_at: new Date().toISOString(),
      },
    })
    .eq('id', purchaseRequestId);

  // Create purchase history record
  await supabase
    .from('purchase_history')
    .insert({
      user_id: purchaseRequest.user_id,
      purchase_request_id: purchaseRequestId,
      virtual_card_id: purchaseRequest.virtual_card_id,
      item_name: purchaseRequest.item_name,
      merchant: purchaseRequest.merchant,
      amount: purchaseRequest.amount,
      currency: purchaseRequest.currency,
      metadata: {
        transaction_details: transactionDetails,
      },
    });

  // Close/pause the virtual card after purchase
  if (purchaseRequest.virtual_card_id && purchaseRequest.virtual_cards) {
    const virtualCard = purchaseRequest.virtual_cards;
    if (virtualCard.privacy_card_id) {
      try {
        await updateCard(virtualCard.privacy_card_id, 'CLOSED');
      } catch (error) {
        console.error('[PURCHASE] Failed to close card after purchase:', error);
        // Non-critical - card will expire or can be closed manually
      }
    }
  }

  console.log('[PURCHASE] Purchase completed:', purchaseRequestId);
}

