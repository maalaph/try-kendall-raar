import { NextRequest, NextResponse } from 'next/server';
import { syncTransactions } from '@/lib/plaid/client';
import { supabase } from '@/lib/supabase';

/**
 * Handle Plaid webhooks
 * POST /api/plaid/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhook_type, webhook_code, item_id } = body;

    console.log('[PLAID WEBHOOK] Received:', { webhook_type, webhook_code, item_id });

    // Get Plaid item from database
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('plaid_item_id', item_id)
      .single();

    if (itemError || !plaidItem) {
      console.error('[PLAID WEBHOOK] Item not found:', item_id);
      return NextResponse.json({ received: true });
    }

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        if (webhook_code === 'SYNC_UPDATES_AVAILABLE') {
          // New transactions available, sync them
          try {
            const { transactions, cursor } = await syncTransactions(
              plaidItem.access_token,
              undefined
            );

            // Get account mapping
            const { data: accounts } = await supabase
              .from('bank_accounts')
              .select('id, plaid_account_id')
              .eq('plaid_item_id', plaidItem.id);

            const accountMap = new Map(
              accounts?.map((acc: any) => [acc.plaid_account_id, acc.id]) || []
            );

            // Store new transactions
            if (transactions.length > 0) {
              const transactionsToInsert = transactions
                .filter((tx: any) => accountMap.has(tx.account_id))
                .map((tx: any) => {
                  const category = tx.personal_finance_category?.primary || tx.category?.[0] || 'Other';
                  const detailedCategory = tx.personal_finance_category?.detailed || tx.category?.join(' > ') || 'Other';

                  return {
                    user_id: plaidItem.user_id,
                    account_id: accountMap.get(tx.account_id),
                    plaid_transaction_id: tx.transaction_id,
                    amount: Math.round(tx.amount * 100),
                    date: tx.date,
                    authorized_date: tx.authorized_date || null,
                    merchant_name: tx.merchant_name || tx.name,
                    name: tx.name,
                    category: tx.category?.join(' > ') || category,
                    category_id: tx.category_id || null,
                    primary_category: category,
                    detailed_category: detailedCategory,
                    personal_finance_category: tx.personal_finance_category || null,
                    pending: tx.pending || false,
                    iso_currency_code: tx.iso_currency_code || 'USD',
                    location: tx.location || null,
                    payment_meta: tx.payment_meta || null,
                    payment_channel: tx.payment_channel || null,
                  };
                });

              await supabase
                .from('transactions')
                .upsert(transactionsToInsert, {
                  onConflict: 'account_id,plaid_transaction_id',
                });
            }

            console.log('[PLAID WEBHOOK] Synced transactions:', transactions.length);
          } catch (error: any) {
            console.error('[PLAID WEBHOOK] Failed to sync transactions:', error);
          }
        }
        break;

      case 'ITEM':
        if (webhook_code === 'ERROR') {
          // Item error, update status
          await supabase
            .from('plaid_items')
            .update({
              status: 'error',
              error: body.error || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', plaidItem.id);
        } else if (webhook_code === 'PENDING_EXPIRATION') {
          // Access token expiring soon
          console.warn('[PLAID WEBHOOK] Access token expiring for item:', item_id);
          // TODO: Notify user to reconnect
        }
        break;

      default:
        console.log('[PLAID WEBHOOK] Unhandled webhook type:', webhook_type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[PLAID WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ received: true }); // Always return success to Plaid
  }
}

