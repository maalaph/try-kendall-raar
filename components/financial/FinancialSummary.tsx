'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface FinancialSummaryProps {
  recordId: string;
}

interface SummaryData {
  totalBalance: number;
  totalSpent: number;
  spendingByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    balance: number;
  }>;
}

export default function FinancialSummary({ recordId }: FinancialSummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'week' | 'year'>('month');

  useEffect(() => {
    fetchSummary();
  }, [recordId, timeRange]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/financial/summary?recordId=${recordId}&timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success && data.summary) {
        setSummary({
          totalBalance: data.summary.totalBalance || 0,
          totalSpent: data.summary.spending?.total || 0,
          spendingByCategory: data.summary.spending?.categories || [],
          accounts: data.summary.accounts || [],
        });
      }
    } catch (error) {
      console.error('Error fetching financial summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          Loading summary...
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          No financial data available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light" style={{ color: colors.text }}>
            Total Balance
          </h3>
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className="px-3 py-1 text-xs font-light rounded-sm transition-all duration-200"
                style={{
                  backgroundColor: timeRange === range ? colors.accent : 'transparent',
                  color: colors.text,
                  border: `1px solid ${timeRange === range ? colors.accent : colors.text}33`,
                  opacity: timeRange === range ? 1 : 0.7,
                  cursor: 'pointer',
                }}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-4xl font-light mb-2" style={{ color: colors.text }}>
            {formatCurrency(summary.totalBalance)}
          </p>
          <p className="text-xs font-light" style={{ color: colors.text, opacity: 0.5 }}>
            Across {summary.accounts.length} account{summary.accounts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Spending This Period */}
        <div className="pt-4 border-t" style={{ borderColor: `${colors.text}22` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-light mb-1" style={{ color: colors.text, opacity: 0.6 }}>
                Spent this {timeRange === 'week' ? 'week' : timeRange === 'month' ? 'month' : 'year'}
              </p>
              <p className="text-2xl font-light" style={{ color: colors.text }}>
                {formatCurrency(summary.totalSpent)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Spending Categories */}
      {summary.spendingByCategory.length > 0 && (
        <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
          <h3 className="text-lg font-light mb-4" style={{ color: colors.text }}>
            Top Categories
          </h3>
          <div className="space-y-4">
            {summary.spendingByCategory.slice(0, 5).map((item, index) => (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-light" style={{ color: colors.text }}>
                    {item.category}
                  </span>
                  <span className="text-sm font-light" style={{ color: colors.text }}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.text}11` }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      backgroundColor: colors.accent,
                      opacity: 0.6,
                    }}
                  />
                </div>
                <p className="text-xs font-light" style={{ color: colors.text, opacity: 0.4 }}>
                  {item.percentage.toFixed(1)}% of spending
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

