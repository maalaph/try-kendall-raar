import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken, getAccounts, getInstitution } from '@/lib/plaid/client';
import { supabase } from '@/lib/supabase';

/**
 * Exchange public token for access token and store connection
 * POST /api/plaid/exchange-public-token
 * Body: { public_token: string, recordId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { public_token, recordId } = body;

    if (!public_token || !recordId) {
      return NextResponse.json(
        { error: 'public_token and recordId are required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const { access_token, item_id } = await exchangePublicToken(public_token);

    // Get accounts for this item
    const { accounts, item } = await getAccounts(access_token);

    // Get institution info
    let institutionName = 'Unknown Institution';
    try {
      const institution = await getInstitution(item.institution_id || '');
      institutionName = institution.name || institutionName;
    } catch (error) {
      console.warn('[PLAID] Failed to get institution name:', error);
    }

    // Store Plaid item in database
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: recordId,
        plaid_item_id: item_id,
        institution_id: item.institution_id,
        institution_name: institutionName,
        access_token: access_token, // TODO: Encrypt this before storing
        status: 'active',
      })
      .select()
      .single();

    if (itemError) {
      console.error('[PLAID] Failed to store Plaid item:', itemError);
      throw new Error(`Failed to store Plaid item: ${itemError.message}`);
    }

    // Store accounts in database
    // Plaid returns balances in dollars, convert to cents for storage consistency
    const accountsToInsert = accounts.map((account: any) => ({
      user_id: recordId,
      plaid_item_id: plaidItem.id,
      plaid_account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      balance_available: account.balances.available !== null ? Math.round(account.balances.available * 100) : null,
      balance_current: account.balances.current !== null ? Math.round(account.balances.current * 100) : null,
      balance_limit: account.balances.limit !== null ? Math.round(account.balances.limit * 100) : null,
      balance_iso_currency_code: account.balances.iso_currency_code || 'USD',
      status: account.balances.current !== null ? 'active' : 'inactive',
    }));

    const { error: accountsError } = await supabase
      .from('bank_accounts')
      .upsert(accountsToInsert, {
        onConflict: 'user_id,plaid_item_id,plaid_account_id',
      });

    if (accountsError) {
      console.error('[PLAID] Failed to store accounts:', accountsError);
      throw new Error(`Failed to store accounts: ${accountsError.message}`);
    }

    return NextResponse.json({
      success: true,
      item_id: item_id,
      institution_name: institutionName,
      accounts_count: accounts.length,
    });
  } catch (error: any) {
    console.error('[PLAID] Failed to exchange public token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to exchange public token' },
      { status: 500 }
    );
  }
}

