'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/lib/config';

interface SubscriptionsProps {
  recordId: string;
}

interface Subscription {
  merchant_name: string;
  amount: number;
  frequency: string;
  occurrences: number;
  last_charge_date: string;
  next_charge_date: string;
}

export default function Subscriptions({ recordId }: SubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, [recordId]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/financial/subscriptions?recordId=${recordId}`);
      const data = await response.json();
      
      if (data.success && data.subscriptions) {
        setSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      bimonthly: 'Bi-monthly',
      yearly: 'Yearly',
    };
    return labels[frequency] || frequency;
  };

  const calculateMonthlyCost = (subscription: Subscription) => {
    switch (subscription.frequency) {
      case 'weekly':
        return subscription.amount * 4.33; // Average weeks per month
      case 'biweekly':
        return subscription.amount * 2.17;
      case 'monthly':
        return subscription.amount;
      case 'bimonthly':
        return subscription.amount / 2;
      case 'yearly':
        return subscription.amount / 12;
      default:
        return subscription.amount;
    }
  };

  const totalMonthly = subscriptions.reduce((sum, sub) => sum + calculateMonthlyCost(sub), 0);

  if (loading) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          Detecting subscriptions...
        </div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
        <h3 className="text-lg font-light mb-2" style={{ color: colors.text }}>
          Subscriptions
        </h3>
        <div className="text-sm" style={{ color: colors.text, opacity: 0.6 }}>
          No recurring subscriptions detected yet. Check back after more transactions are synced.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-sm" style={{ backgroundColor: colors.secondary }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-light" style={{ color: colors.text }}>
          Subscriptions
        </h3>
        <div className="text-right">
          <p className="text-xs font-light mb-1" style={{ color: colors.text, opacity: 0.6 }}>
            Estimated Monthly
          </p>
          <p className="text-xl font-light" style={{ color: colors.text }}>
            {formatCurrency(totalMonthly)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {subscriptions.map((subscription) => (
          <div
            key={`${subscription.merchant_name}-${subscription.amount}`}
            className="py-3 border-b last:border-b-0"
            style={{ borderColor: `${colors.text}11` }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-light mb-1" style={{ color: colors.text }}>
                  {subscription.merchant_name}
                </p>
                <div className="flex items-center gap-3 text-xs font-light" style={{ color: colors.text, opacity: 0.6 }}>
                  <span>{getFrequencyLabel(subscription.frequency)}</span>
                  <span>•</span>
                  <span>{subscription.occurrences} charge{subscription.occurrences !== 1 ? 's' : ''} detected</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-light mb-1" style={{ color: colors.text }}>
                  {formatCurrency(subscription.amount)}
                </p>
                <p className="text-xs font-light" style={{ color: colors.text, opacity: 0.5 }}>
                  ~{formatCurrency(calculateMonthlyCost(subscription))}/mo
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-light mt-2" style={{ color: colors.text, opacity: 0.5 }}>
              <span>Last: {formatDate(subscription.last_charge_date)}</span>
              <span>•</span>
              <span>Next: ~{formatDate(subscription.next_charge_date)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: `${colors.text}22` }}>
        <p className="text-xs font-light text-center" style={{ color: colors.text, opacity: 0.5 }}>
          Detected from transaction patterns • {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

