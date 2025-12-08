import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { removeItem } from '@/lib/plaid/client';

/**
 * Disconnect all Plaid items (bank accounts) for a user
 * DELETE /api/plaid/disconnect?recordId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get all active Plaid items for this user
    const { data: items, error: fetchError } = await supabase
      .from('plaid_items')
      .select('id, plaid_item_id, access_token')
      .eq('user_id', recordId)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[PLAID] Failed to fetch items for disconnect:', fetchError);
      throw new Error(`Failed to fetch Plaid items: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No connected accounts to disconnect',
        disconnected_count: 0,
      });
    }

    // Call Plaid's item/remove endpoint to properly disconnect
    // Note: This revokes the access token with Plaid (good practice)
    const disconnectPromises = items.map(async (item) => {
      try {
        await removeItem(item.access_token);
        console.log(`[PLAID] Disconnected item ${item.plaid_item_id} from Plaid`);
      } catch (error: any) {
        // Log but don't fail - we'll still remove from database
        console.warn(`[PLAID] Failed to disconnect item from Plaid (may already be disconnected):`, error.message);
      }
    });

    await Promise.allSettled(disconnectPromises);

    // Delete all Plaid items (this will cascade delete accounts and transactions)
    const { error: deleteError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('user_id', recordId);

    if (deleteError) {
      console.error('[PLAID] Failed to delete items:', deleteError);
      throw new Error(`Failed to delete Plaid items: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully disconnected ${items.length} bank account(s)`,
      disconnected_count: items.length,
    });
  } catch (error: any) {
    console.error('[PLAID] Failed to disconnect accounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect accounts' },
      { status: 500 }
    );
  }
}

