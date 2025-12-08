'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface Transaction {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string | null;
  primary_category: string | null;
  pending: boolean;
}

interface TransactionsProps {
  recordId: string;
  accountId?: string;
  limit?: number;
}

export default function Transactions({ recordId, accountId, limit = 50 }: TransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [recordId, accountId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let url = `/api/financial/transactions?recordId=${recordId}&limit=${limit}`;
      if (accountId) {
        url += `&accountId=${accountId}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    const amount = cents / 100;
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    
    return (
      <span style={{ color: isNegative ? colors.text : colors.accent }}>
        {isNegative ? '-' : '+'}
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
        }).format(absAmount)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const groupByDate = (transactions: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    
    transactions.forEach((tx) => {
      const date = formatDate(tx.date);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          No transactions yet.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-light" style={{ color: colors.text }}>
        Recent Transactions
      </h2>

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, txs]) => (
          <div key={date} className="space-y-2">
            <p className="text-xs font-light mb-3" style={{ color: colors.text, opacity: 0.5 }}>
              {date}
            </p>
            {txs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 transition-opacity duration-200"
                style={{
                  opacity: tx.pending ? 0.7 : 1,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light truncate" style={{ color: colors.text }}>
                    {tx.merchant_name || tx.name}
                  </p>
                  {tx.primary_category && (
                    <p className="text-xs font-light mt-0.5" style={{ color: colors.text, opacity: 0.5 }}>
                      {tx.primary_category}
                    </p>
                  )}
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-light">
                    {formatCurrency(tx.amount)}
                  </p>
                  {tx.pending && (
                    <p className="text-xs font-light mt-0.5" style={{ color: colors.text, opacity: 0.5 }}>
                      Pending
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

