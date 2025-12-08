import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAccounts } from '@/lib/plaid/client';

/**
 * Get user's connected bank accounts
 * GET /api/plaid/accounts?recordId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get all accounts for user with institution info
    const { data: accounts, error } = await supabase
      .from('bank_accounts')
      .select(`
        *,
        plaid_items!inner (
          id,
          institution_name,
          status,
          access_token
        )
      `)
      .eq('user_id', recordId)
      .eq('status', 'active')
      .eq('plaid_items.status', 'active')
      .order('created_at', { ascending: false });

    // Refresh balances from Plaid if requested
    if (refresh && accounts && accounts.length > 0) {
      // Group accounts by item to batch refresh
      const itemsMap = new Map<string, { item: any; accounts: any[] }>();
      
      accounts.forEach((account: any) => {
        const itemId = account.plaid_items.id;
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            item: account.plaid_items,
            accounts: [],
          });
        }
        itemsMap.get(itemId)!.accounts.push(account);
      });

      // Refresh balances for each item
      for (const [itemId, { item, accounts: itemAccounts }] of itemsMap) {
        try {
          const { accounts: updatedAccounts } = await getAccounts(item.access_token);
          
          // Update balances in database (Plaid returns in dollars, convert to cents)
          for (const updatedAccount of updatedAccounts) {
            const matchingAccount = itemAccounts.find(
              (acc: any) => acc.plaid_account_id === updatedAccount.account_id
            );
            
            if (matchingAccount) {
              await supabase
                .from('bank_accounts')
                .update({
                  balance_available: updatedAccount.balances.available !== null ? Math.round(updatedAccount.balances.available * 100) : null,
                  balance_current: updatedAccount.balances.current !== null ? Math.round(updatedAccount.balances.current * 100) : null,
                  balance_limit: updatedAccount.balances.limit !== null ? Math.round(updatedAccount.balances.limit * 100) : null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', matchingAccount.id);
            }
          }
        } catch (balanceError) {
          console.error(`[PLAID] Failed to refresh balances for item ${itemId}:`, balanceError);
          // Continue with cached balances if refresh fails
        }
      }

      // Re-fetch accounts after refresh
      const { data: refreshedAccounts } = await supabase
        .from('bank_accounts')
        .select(`
          *,
          plaid_items!inner (
            id,
            institution_name,
            status
          )
        `)
        .eq('user_id', recordId)
        .eq('status', 'active')
        .eq('plaid_items.status', 'active')
        .order('created_at', { ascending: false });

      if (refreshedAccounts) {
        accounts.length = 0;
        accounts.push(...refreshedAccounts);
      }
    }

    if (error) {
      console.error('[PLAID] Failed to fetch accounts:', error);
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }

    // Format accounts for frontend
    const formattedAccounts = accounts?.map((account: any) => ({
      id: account.id,
      plaid_account_id: account.plaid_account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      institution_name: account.plaid_items.institution_name,
      balance: {
        available: account.balance_available ? Number(account.balance_available) / 100 : null,
        current: account.balance_current ? Number(account.balance_current) / 100 : null,
        limit: account.balance_limit ? Number(account.balance_limit) / 100 : null,
        currency: account.balance_iso_currency_code || 'USD',
      },
      updated_at: account.updated_at,
    })) || [];

    return NextResponse.json({
      accounts: formattedAccounts,
      count: formattedAccounts.length,
    });
  } catch (error: any) {
    console.error('[PLAID] Failed to get accounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get accounts' },
      { status: 500 }
    );
  }
}

