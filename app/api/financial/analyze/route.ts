import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Analyze spending patterns
 * GET /api/financial/analyze?recordId=xxx&timeRange=month&category=Food
 */
export async function GET(request: NextRequest) {
  try {
    const recordId = request.nextUrl.searchParams.get('recordId');
    const timeRange = request.nextUrl.searchParams.get('timeRange') || 'month';
    const category = request.nextUrl.searchParams.get('category');

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
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Build query
    let query = supabase
      .from('transactions')
      .select('amount, primary_category, merchant_name')
      .eq('user_id', recordId)
      .gte('date', startDate.toISOString().split('T')[0])
      .eq('pending', false)
      .lt('amount', 0); // Only debits

    if (category) {
      query = query.eq('primary_category', category);
    }

    const { data: transactions } = await query;

    // Calculate spending by category
    const categorySpending = new Map<string, number>();
    const merchantSpending = new Map<string, number>();
    let totalSpent = 0;

    transactions?.forEach((tx: any) => {
      const amount = Math.abs(tx.amount / 100);
      totalSpent += amount;

      // By category
      const cat = tx.primary_category || 'Other';
      categorySpending.set(cat, (categorySpending.get(cat) || 0) + amount);

      // By merchant
      if (tx.merchant_name) {
        merchantSpending.set(tx.merchant_name, (merchantSpending.get(tx.merchant_name) || 0) + amount);
      }
    });

    const byCategory = Array.from(categorySpending.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topMerchants = Array.from(merchantSpending.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      analysis: {
        totalSpent,
        byCategory,
        topMerchants,
      },
    });
  } catch (error: any) {
    console.error('[FINANCIAL] Failed to analyze spending:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze spending' },
      { status: 500 }
    );
  }
}

