import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Get financial summary for user
 * GET /api/financial/summary?recordId=xxx&timeRange=month
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    const timeRange = request.nextUrl.searchParams.get('timeRange') || 'month';

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get accounts
    const { data: items } = await supabase
      .from('plaid_items')
      .select('id')
      .eq('user_id', recordId)
      .eq('status', 'active');

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No connected accounts',
      });
    }

    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', recordId)
      .eq('status', 'active')
      .in('plaid_item_id', items.map(item => item.id));

    // Calculate total balance
    let totalBalance = 0;
    accounts?.forEach((acc: any) => {
      if (acc.balance_current) {
        totalBalance += Number(acc.balance_current) / 100;
      }
    });

    // Get recent transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', recordId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(10);

    // Calculate spending by category
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('amount, primary_category')
      .eq('user_id', recordId)
      .gte('date', startDate.toISOString().split('T')[0])
      .eq('pending', false);

    const categorySpending = new Map<string, number>();
    let totalSpent = 0;

    allTransactions?.forEach((tx: any) => {
      if (tx.amount < 0) {
        const category = tx.primary_category || 'Other';
        const amount = Math.abs(tx.amount / 100);
        categorySpending.set(category, (categorySpending.get(category) || 0) + amount);
        totalSpent += amount;
      }
    });

    const spendingByCategory = Array.from(categorySpending.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      summary: {
        accounts: accounts?.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: acc.balance_current ? Number(acc.balance_current) / 100 : 0,
        })) || [],
        totalBalance,
        recentTransactions: transactions?.map((tx: any) => ({
          id: tx.id,
          name: tx.name,
          merchant_name: tx.merchant_name,
          amount: Number(tx.amount),
          date: tx.date,
          category: tx.primary_category,
        })) || [],
        spending: {
          total: totalSpent,
          categories: spendingByCategory,
        },
      },
    });
  } catch (error: any) {
    console.error('[FINANCIAL] Failed to get summary:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get financial summary' },
      { status: 500 }
    );
  }
}

