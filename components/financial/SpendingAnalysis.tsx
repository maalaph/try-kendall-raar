'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface SpendingAnalysisProps {
  recordId: string;
}

interface AnalysisData {
  totalSpent: number;
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  topMerchants: Array<{
    name: string;
    amount: number;
  }>;
}

export default function SpendingAnalysis({ recordId }: SpendingAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | '3months' | 'year'>('month');

  useEffect(() => {
    fetchAnalysis();
  }, [recordId, timeRange]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/financial/analyze?recordId=${recordId}&timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error fetching spending analysis:', error);
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

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case '3months': return 'Last 3 Months';
      case 'year': return 'This Year';
      default: return 'This Month';
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          Loading analysis...
        </div>
      </div>
    );
  }

  if (!analysis || analysis.totalSpent === 0) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          No spending data available for this period
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-light" style={{ color: colors.text }}>
          Spending Trends
        </h3>
        <div className="flex gap-2">
          {(['week', 'month', '3months', 'year'] as const).map((range) => (
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
              {range === '3months' ? '3M' : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Total Spending */}
      <div className="mb-6 pb-4 border-b" style={{ borderColor: `${colors.text}22` }}>
        <p className="text-xs font-light mb-1" style={{ color: colors.text, opacity: 0.6 }}>
          Total Spent - {getTimeRangeLabel()}
        </p>
        <p className="text-3xl font-light" style={{ color: colors.text }}>
          {formatCurrency(analysis.totalSpent)}
        </p>
      </div>

      {/* Category Breakdown */}
      {analysis.byCategory.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-light mb-4" style={{ color: colors.text, opacity: 0.8 }}>
            By Category
          </h4>
          <div className="space-y-3">
            {analysis.byCategory.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-light" style={{ color: colors.text }}>
                    {item.category}
                  </span>
                  <span className="text-sm font-light" style={{ color: colors.text }}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.text}11` }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Merchants */}
      {analysis.topMerchants.length > 0 && (
        <div>
          <h4 className="text-sm font-light mb-4" style={{ color: colors.text, opacity: 0.8 }}>
            Top Merchants
          </h4>
          <div className="space-y-2">
            {analysis.topMerchants.slice(0, 5).map((merchant, index) => (
              <div
                key={merchant.name}
                className="flex items-center justify-between py-2"
                style={{
                  borderBottom: index < analysis.topMerchants.slice(0, 5).length - 1 ? `1px solid ${colors.text}11` : 'none',
                }}
              >
                <span className="text-sm font-light" style={{ color: colors.text }}>
                  {merchant.name}
                </span>
                <span className="text-sm font-light" style={{ color: colors.text }}>
                  {formatCurrency(merchant.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

