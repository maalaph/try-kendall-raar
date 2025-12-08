'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';
import PlaidLinkButton from './PlaidLinkButton';

interface Account {
  id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  mask: string;
  institution_name: string;
  balance: {
    available: number | null;
    current: number | null;
    limit: number | null;
    currency: string;
  };
}

interface BankAccountsProps {
  recordId: string;
}

export default function BankAccounts({ recordId }: BankAccountsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchAccounts = async (refreshBalances = false) => {
    try {
      setLoading(true);
      const url = `/api/plaid/accounts?recordId=${recordId}${refreshBalances ? '&refresh=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recordId) {
      // Refresh balances on initial load
      fetchAccounts(true);
    }
  }, [recordId]);

  const handleConnectionSuccess = () => {
    setConnecting(false);
    // Refresh accounts after connection
    setTimeout(() => {
      fetchAccounts();
    }, 1000);
  };

  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getAccountTypeLabel = (type: string, subtype?: string) => {
    if (type === 'depository') {
      return subtype === 'checking' ? 'Checking' : subtype === 'savings' ? 'Savings' : 'Bank Account';
    }
    if (type === 'credit') return 'Credit Card';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
        Loading accounts...
      </div>
    );
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect all bank accounts? This will remove all connected accounts and their transaction history.')) {
      return;
    }

    try {
      const response = await fetch(`/api/plaid/disconnect?recordId=${recordId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Refresh accounts list
        await fetchAccounts();
      } else {
        alert(data.error || 'Failed to disconnect accounts');
      }
    } catch (error) {
      console.error('Error disconnecting accounts:', error);
      alert('Error disconnecting accounts. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-light" style={{ color: colors.text }}>
          Bank Accounts
        </h2>
        {accounts.length > 0 && (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-sm font-light rounded-sm transition-all duration-200"
            style={{
              backgroundColor: 'transparent',
              color: colors.text,
              opacity: 0.7,
              border: `1px solid ${colors.text}33`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.borderColor = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.borderColor = `${colors.text}33`;
            }}
          >
            Disconnect All
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm mb-4" style={{ color: colors.text, opacity: 0.6 }}>
            No bank accounts connected yet.
          </p>
          <PlaidLinkButton
            recordId={recordId}
            onSuccess={() => {
              setConnecting(true);
              handleConnectionSuccess();
            }}
            onExit={() => setConnecting(false)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="p-4 rounded-sm transition-all duration-200"
              style={{
                backgroundColor: colors.secondary,
                border: `1px solid ${colors.secondary}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = `0 0 10px ${colors.accent}22`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.secondary;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="mb-2">
                <p className="text-sm font-light" style={{ color: colors.text, opacity: 0.6 }}>
                  {account.institution_name}
                </p>
                <p className="text-base font-light" style={{ color: colors.text }}>
                  {account.name}
                </p>
                <p className="text-xs font-light mt-1" style={{ color: colors.text, opacity: 0.5 }}>
                  {getAccountTypeLabel(account.type, account.subtype)}
                  {account.mask && ` • • • • ${account.mask}`}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.secondary }}>
                {account.type === 'credit' ? (
                  <div>
                    <p className="text-xs font-light mb-1" style={{ color: colors.text, opacity: 0.6 }}>
                      Available Credit
                    </p>
                    <p className="text-lg font-light" style={{ color: colors.text }}>
                      {formatCurrency(
                        account.balance.limit && account.balance.current
                          ? account.balance.limit - account.balance.current
                          : account.balance.available,
                        account.balance.currency
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-light mb-1" style={{ color: colors.text, opacity: 0.6 }}>
                      Balance
                    </p>
                    <p className="text-lg font-light" style={{ color: colors.text }}>
                      {formatCurrency(account.balance.current, account.balance.currency)}
                    </p>
                    {account.balance.available !== null && 
                     account.balance.available !== account.balance.current && (
                      <p className="text-xs font-light mt-1" style={{ color: colors.text, opacity: 0.5 }}>
                        Available: {formatCurrency(account.balance.available, account.balance.currency)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

