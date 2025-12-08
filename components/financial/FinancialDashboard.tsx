'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/lib/config';
import BankAccounts from './BankAccounts';
import Transactions from './Transactions';
import FinancialSummary from './FinancialSummary';
import SpendingAnalysis from './SpendingAnalysis';
import Subscriptions from './Subscriptions';

interface FinancialDashboardProps {
  recordId: string;
}

export default function FinancialDashboard({ recordId }: FinancialDashboardProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync transactions on mount if accounts exist
  useEffect(() => {
    syncTransactionsOnMount();
  }, [recordId]);

  const syncTransactionsOnMount = async () => {
    try {
      const accountsResponse = await fetch(`/api/plaid/accounts?recordId=${recordId}`);
      const accountsData = await accountsResponse.json();
      
      if (accountsData.accounts && accountsData.accounts.length > 0) {
        // Trigger sync in background
        fetch('/api/plaid/sync-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to check accounts:', error);
    }
  };

  const handleSyncTransactions = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });
      
      const data = await response.json();
      if (data.success) {
        // Refresh balances and data
        await refreshAllData();
      }
    } catch (error) {
      console.error('Failed to sync transactions:', error);
    } finally {
      setSyncing(false);
    }
  };

  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      // Trigger page refresh to reload all components
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8 p-6" style={{ backgroundColor: colors.primary, minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-light" style={{ color: colors.text }}>
            Financial Overview
          </h1>
          <button
            onClick={handleSyncTransactions}
            disabled={syncing || refreshing}
            className="px-4 py-2 text-sm font-light rounded-sm transition-all duration-200"
            style={{
              backgroundColor: (syncing || refreshing) ? colors.secondary : colors.accent,
              color: colors.text,
              opacity: (syncing || refreshing) ? 0.6 : 1,
              cursor: (syncing || refreshing) ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? 'Syncing...' : refreshing ? 'Refreshing...' : 'Sync Transactions'}
          </button>
        </div>

        {/* Summary Section - Top Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <FinancialSummary recordId={recordId} />
          </div>
          <div className="lg:col-span-2">
            <SpendingAnalysis recordId={recordId} />
          </div>
        </div>

        {/* Accounts and Transactions - Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <BankAccounts recordId={recordId} />
          </div>
          <div className="lg:col-span-2">
            <Transactions recordId={recordId} />
          </div>
        </div>

        {/* Subscriptions - Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <Subscriptions recordId={recordId} />
          </div>
        </div>
      </div>
    </div>
  );
}

