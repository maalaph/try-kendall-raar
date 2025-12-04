'use client';

import { useState, useEffect } from 'react';
import StatCard from './StatCard';
import { colors } from '@/lib/config';

interface Stats {
  totalCalls: number;
  totalCallMinutes: number;
  averageCallDuration: number;
  unreadMessages: number;
  recentActivity: Array<{
    id: string;
    callerPhone: string;
    note: string;
    timestamp: string;
    callDuration?: number;
    read: boolean;
  }>;
  inboundCalls: Array<{
    id: string;
    callerPhone: string;
    note: string;
    timestamp: string;
    callDuration?: number;
    read: boolean;
  }>;
  outboundCalls: Array<{
    id: string;
    callerPhone: string;
    note: string;
    timestamp: string;
    callDuration?: number;
    read: boolean;
  }>;
}

interface StatsDashboardProps {
  recordId: string;
}

export default function StatsDashboard({ recordId }: StatsDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/stats?recordId=${encodeURIComponent(recordId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStats(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [recordId]);

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div style={{ color: colors.text, opacity: 0.6 }}>Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div style={{ color: colors.text, opacity: 0.6 }}>Failed to load statistics</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Total Calls"
          value={stats.totalCalls}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />
        <StatCard
          label="Total Call Minutes"
          value={stats.totalCallMinutes.toFixed(1)}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="Average Call Duration"
          value={formatDuration(stats.averageCallDuration)}
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Recent Activity */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: `${colors.accent}15`,
          border: `1px solid ${colors.accent}40`,
        }}
      >
        <h2
          className="mb-4"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Recent Activity
        </h2>

        {stats.recentActivity.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.text, opacity: 0.6 }}>
            No recent activity
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: colors.primary,
                  border: `1px solid ${colors.accent}30`,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: colors.accent }}
                    >
                      {formatPhone(activity.callerPhone)}
                    </span>
                    <span
                      className="text-xs ml-3"
                      style={{ color: colors.text, opacity: 0.6 }}
                    >
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  {activity.callDuration && (
                    <span
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.6 }}
                    >
                      {formatDuration(activity.callDuration)}
                    </span>
                  )}
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: colors.text,
                    opacity: 0.9,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {activity.note}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Logs */}
      <div
        className="rounded-xl p-6 mt-8"
        style={{
          backgroundColor: `${colors.accent}15`,
          border: `1px solid ${colors.accent}40`,
        }}
      >
        <h2
          className="mb-4"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Call Logs
        </h2>

        {/* Inbound Section */}
        <div className="mb-6">
          <h3
            className="mb-3 text-sm font-semibold"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              color: colors.accent,
            }}
          >
            Inbound (Owner-Assistant)
          </h3>
          {!stats.inboundCalls || stats.inboundCalls.length === 0 ? (
            <div className="text-center py-4" style={{ color: colors.text, opacity: 0.6 }}>
              No inbound calls yet
            </div>
          ) : (
            <div className="space-y-3">
              {stats.inboundCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: colors.primary,
                    border: `1px solid ${colors.accent}30`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.accent }}
                      >
                        You
                      </span>
                      <span
                        className="text-xs ml-3"
                        style={{ color: colors.text, opacity: 0.6 }}
                      >
                        {formatTimestamp(call.timestamp)}
                      </span>
                    </div>
                    {call.callDuration && (
                      <span
                        className="text-xs"
                        style={{ color: colors.text, opacity: 0.6 }}
                      >
                        {formatDuration(call.callDuration)}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: colors.text,
                      opacity: 0.9,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {call.note}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outbound Section */}
        <div>
          <h3
            className="mb-3 text-sm font-semibold"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              color: colors.accent,
            }}
          >
            Outbound (Assistant-to-Recipient)
          </h3>
          {!stats.outboundCalls || stats.outboundCalls.length === 0 ? (
            <div className="text-center py-4" style={{ color: colors.text, opacity: 0.6 }}>
              No outbound calls yet
            </div>
          ) : (
            <div className="space-y-3">
              {stats.outboundCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: colors.primary,
                    border: `1px solid ${colors.accent}30`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.accent }}
                      >
                        {formatPhone(call.callerPhone)}
                      </span>
                      <span
                        className="text-xs ml-3"
                        style={{ color: colors.text, opacity: 0.6 }}
                      >
                        {formatTimestamp(call.timestamp)}
                      </span>
                    </div>
                    {call.callDuration && (
                      <span
                        className="text-xs"
                        style={{ color: colors.text, opacity: 0.6 }}
                      >
                        {formatDuration(call.callDuration)}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: colors.text,
                      opacity: 0.9,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {call.note}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


