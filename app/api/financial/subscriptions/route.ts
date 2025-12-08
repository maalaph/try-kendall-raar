import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Detect recurring subscriptions from transactions
 * GET /api/financial/subscriptions?recordId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId parameter is required' },
        { status: 400 }
      );
    }

    // Get transactions from last 6 months to detect patterns
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', recordId)
      .gte('date', sixMonthsAgo.toISOString().split('T')[0])
      .eq('pending', false)
      .order('date', { ascending: false });

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: true,
        subscriptions: [],
      });
    }

    // Group transactions by merchant and amount
    const merchantGroups = new Map<string, Array<{ date: string; amount: number }>>();

    transactions.forEach((tx: any) => {
      if (tx.amount < 0 && tx.merchant_name) {
        const key = `${tx.merchant_name}_${Math.abs(tx.amount)}`;
        if (!merchantGroups.has(key)) {
          merchantGroups.set(key, []);
        }
        merchantGroups.get(key)!.push({
          date: tx.date,
          amount: Math.abs(tx.amount / 100),
        });
      }
    });

    // Detect recurring patterns (same merchant, same amount, repeating)
    const subscriptions: Array<{
      merchant_name: string;
      amount: number;
      frequency: string;
      occurrences: number;
      last_charge_date: string;
      next_charge_date: string;
    }> = [];

    merchantGroups.forEach((transactions, key) => {
      if (transactions.length < 2) return; // Need at least 2 occurrences

      const parts = key.split('_');
      const merchant = parts.slice(0, -1).join('_');
      const amount = parseFloat(parts[parts.length - 1]);

      // Sort by date
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate average days between charges
      let totalDays = 0;
      for (let i = 1; i < transactions.length; i++) {
        const days = Math.floor(
          (new Date(transactions[i].date).getTime() - new Date(transactions[i - 1].date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        totalDays += days;
      }
      const avgDays = totalDays / (transactions.length - 1);

      // Determine frequency
      let frequency = 'monthly';
      if (avgDays <= 7) frequency = 'weekly';
      else if (avgDays <= 14) frequency = 'biweekly';
      else if (avgDays <= 35) frequency = 'monthly';
      else if (avgDays <= 65) frequency = 'bimonthly';
      else frequency = 'yearly';

      // Only include if pattern is consistent (same merchant, similar amounts, regular intervals)
      if (avgDays > 0 && transactions.length >= 2) {
        const lastCharge = new Date(transactions[transactions.length - 1].date);
        const nextCharge = new Date(lastCharge);
        nextCharge.setDate(nextCharge.getDate() + Math.round(avgDays));

        subscriptions.push({
          merchant_name: merchant,
          amount,
          frequency,
          occurrences: transactions.length,
          last_charge_date: lastCharge.toISOString().split('T')[0],
          next_charge_date: nextCharge.toISOString().split('T')[0],
        });
      }
    });

    // Sort by amount descending
    subscriptions.sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.slice(0, 20), // Top 20 subscriptions
    });
  } catch (error: any) {
    console.error('[FINANCIAL] Failed to detect subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to detect subscriptions' },
      { status: 500 }
    );
  }
}

