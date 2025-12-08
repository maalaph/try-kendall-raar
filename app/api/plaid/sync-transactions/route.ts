import { NextRequest, NextResponse } from 'next/server';
import { syncTransactions, getAccounts } from '@/lib/plaid/client';
import { supabase } from '@/lib/supabase';

/**
 * Sync transactions from Plaid for a user's connected accounts
 * POST /api/plaid/sync-transactions
 * Body: { recordId: string, itemId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, itemId } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Get Plaid items for user
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', recordId)
      .eq('status', 'active');

    if (itemId) {
      query = query.eq('plaid_item_id', itemId);
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connected accounts found',
        transactions_synced: 0,
      });
    }

    let totalTransactionsSynced = 0;

    // Sync transactions for each item
    for (const item of items) {
      try {
        const accessToken = item.access_token;
        let cursor = null;
        let hasMore = true;
        let transactionsAdded = 0;

        // Get account mapping (Plaid account ID -> our account ID)
        const { data: accounts } = await supabase
          .from('bank_accounts')
          .select('id, plaid_account_id')
          .eq('plaid_item_id', item.id);

        const accountMap = new Map(
          accounts?.map((acc: any) => [acc.plaid_account_id, acc.id]) || []
        );

        // Sync transactions in batches
        while (hasMore) {
          const { transactions, cursor: nextCursor, has_more } = await syncTransactions(
            accessToken,
            cursor || undefined
          );

          // Store transactions in database
          if (transactions.length > 0) {
            const transactionsToInsert = transactions
              .filter((tx: any) => accountMap.has(tx.account_id))
              .map((tx: any) => {
                const category = tx.personal_finance_category?.primary || tx.category?.[0] || 'Other';
                const detailedCategory = tx.personal_finance_category?.detailed || tx.category?.join(' > ') || 'Other';

                return {
                  user_id: recordId,
                  account_id: accountMap.get(tx.account_id),
                  plaid_transaction_id: tx.transaction_id,
                  amount: Math.round(tx.amount * 100), // Convert to cents
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

            if (transactionsToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('transactions')
                .upsert(transactionsToInsert, {
                  onConflict: 'account_id,plaid_transaction_id',
                });

              if (insertError) {
                console.error('[PLAID] Failed to insert transactions:', insertError);
              } else {
                transactionsAdded += transactionsToInsert.length;
              }
            }
          }

          cursor = nextCursor;
          hasMore = has_more || false;

          // Limit to prevent infinite loops
          if (transactionsAdded > 10000) {
            console.warn('[PLAID] Transaction sync limit reached, stopping');
            break;
          }
        }

        // Refresh account balances from Plaid
        try {
          const { accounts: updatedAccounts } = await getAccounts(accessToken);
          
          // Update balances in database (Plaid returns in dollars, convert to cents)
          for (const account of updatedAccounts) {
            await supabase
              .from('bank_accounts')
              .update({
                balance_available: account.balances.available !== null ? Math.round(account.balances.available * 100) : null,
                balance_current: account.balances.current !== null ? Math.round(account.balances.current * 100) : null,
                balance_limit: account.balances.limit !== null ? Math.round(account.balances.limit * 100) : null,
                updated_at: new Date().toISOString(),
              })
              .eq('plaid_account_id', account.account_id)
              .eq('plaid_item_id', item.id);
          }
        } catch (balanceError) {
          console.error(`[PLAID] Failed to refresh balances for item ${item.id}:`, balanceError);
          // Don't fail the whole sync if balance update fails
        }

        // Update item's updated_at timestamp
        await supabase
          .from('plaid_items')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', item.id);

        totalTransactionsSynced += transactionsAdded;
      } catch (itemError: any) {
        console.error(`[PLAID] Failed to sync transactions for item ${item.id}:`, itemError);
        // Continue with other items
      }
    }

    return NextResponse.json({
      success: true,
      transactions_synced: totalTransactionsSynced,
      items_processed: items.length,
    });
  } catch (error: any) {
    console.error('[PLAID] Failed to sync transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}

