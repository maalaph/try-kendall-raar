import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Get user's transactions
 * GET /api/financial/transactions?recordId=xxx&accountId=xxx&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    const accountId = request.nextUrl.searchParams.get('accountId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', recordId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('[FINANCIAL] Failed to fetch transactions:', error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    // Format transactions for frontend
    const formattedTransactions = transactions?.map((tx: any) => ({
      id: tx.id,
      name: tx.name,
      merchant_name: tx.merchant_name,
      amount: Number(tx.amount), // Already in cents
      date: tx.date,
      category: tx.category,
      primary_category: tx.primary_category,
      pending: tx.pending,
    })) || [];

    return NextResponse.json({
      transactions: formattedTransactions,
      count: formattedTransactions.length,
    });
  } catch (error: any) {
    console.error('[FINANCIAL] Failed to get transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get transactions' },
      { status: 500 }
    );
  }
}

