'use client';

import { useState, useEffect } from 'react';
import StatCard from './StatCard';
import { colors } from '@/lib/config';
import { Trash2 } from 'lucide-react';

interface Stats {
  totalCalls: number;
  totalCallMinutes: number;
  averageCallDuration: number;
  unreadMessages: number;
  recentActivity: Array<{
    id: string;
    callerPhone: string;
    callerName?: string;
    note: string;
    timestamp: string;
    callDuration?: number;
    read: boolean;
  }>;
  inboundCalls: Array<{
    id: string;
    callerPhone: string;
    callerName?: string;
    note: string;
    timestamp: string;
    callDuration?: number;
    read: boolean;
  }>;
  outboundCalls: Array<{
    id: string;
    callerPhone: string;
    callerName?: string;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchStats();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [recordId]);

  const handleDelete = async (callNoteId: string) => {
    if (!confirm('Are you sure you want to delete this transcript? This action cannot be undone.')) {
      return;
    }

    setDeletingId(callNoteId);
    try {
      const response = await fetch(`/api/stats?recordId=${encodeURIComponent(recordId)}&callNoteId=${encodeURIComponent(callNoteId)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refresh stats after deletion
        await fetchStats();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete transcript');
      }
    } catch (error) {
      console.error('Failed to delete transcript:', error);
      alert('Failed to delete transcript. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      {/* Stats Cards - Simplified and cleaner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 justify-items-center">
        <StatCard
          label="Total Calls"
          value={stats.totalCalls.toString()}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />
        <StatCard
          label="Total Minutes"
          value={stats.totalCallMinutes.toFixed(1)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(stats.averageCallDuration)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Recent Activity - Simplified */}
      <div className="mb-10">
        <h2
          className="mb-4 text-xl font-semibold text-center"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            color: colors.text,
          }}
        >
          Recent Activity
        </h2>

        {stats.recentActivity.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.text, opacity: 0.5 }}>
            No recent activity
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="group flex items-start gap-4 p-4 rounded-lg transition-all mx-auto"
                style={{
                  backgroundColor: `${colors.accent}08`,
                  border: `1px solid ${colors.accent}20`,
                  maxWidth: '100%',
                }}
              >
                <div className="flex-1 min-w-0 text-center">
                  <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
                    <span
                      className="text-sm font-medium"
                      style={{ color: colors.accent }}
                    >
                      {activity.callerName || formatPhone(activity.callerPhone)}
                    </span>
                    <span
                      className="text-xs whitespace-nowrap"
                      style={{ color: colors.text, opacity: 0.5 }}
                    >
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    {activity.callDuration && (
                      <span
                        className="text-xs whitespace-nowrap"
                        style={{ color: colors.text, opacity: 0.5 }}
                      >
                        {formatDuration(activity.callDuration)}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm leading-relaxed text-center"
                    style={{
                      color: colors.text,
                      opacity: 0.8,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {activity.note}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(activity.id)}
                  disabled={deletingId === activity.id}
                  className="opacity-0 group-hover:opacity-50 p-1.5 rounded transition-all hover:opacity-100 disabled:opacity-30"
                  style={{ color: colors.text }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Logs - Simplified and cleaner */}
      <div>
        <h2
          className="mb-4 text-xl font-semibold text-center"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            color: colors.text,
          }}
        >
          Call Logs
        </h2>

        {/* Inbound Section */}
        <div className="mb-8">
          <h3
            className="mb-3 text-sm font-medium uppercase tracking-wide text-center"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              color: colors.text,
              opacity: 0.7,
            }}
          >
            Inbound
          </h3>
          {!stats.inboundCalls || stats.inboundCalls.length === 0 ? (
            <div className="text-center py-6" style={{ color: colors.text, opacity: 0.5 }}>
              No inbound calls
            </div>
          ) : (
            <div className="space-y-2">
              {stats.inboundCalls.map((call) => (
                <div
                  key={call.id}
                  className="group flex items-start gap-4 p-4 rounded-lg transition-all mx-auto"
                  style={{
                    backgroundColor: `${colors.accent}08`,
                    border: `1px solid ${colors.accent}20`,
                    maxWidth: '100%',
                  }}
                >
                  <div className="flex-1 min-w-0 text-center">
                    <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.accent }}
                      >
                        {call.callerName || 'You'}
                      </span>
                      <span
                        className="text-xs whitespace-nowrap"
                        style={{ color: colors.text, opacity: 0.5 }}
                      >
                        {formatTimestamp(call.timestamp)}
                      </span>
                      {call.callDuration && (
                        <span
                          className="text-xs whitespace-nowrap"
                          style={{ color: colors.text, opacity: 0.5 }}
                        >
                          {formatDuration(call.callDuration)}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm leading-relaxed text-center"
                      style={{
                        color: colors.text,
                        opacity: 0.8,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      {call.note}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(call.id)}
                    disabled={deletingId === call.id}
                    className="opacity-0 group-hover:opacity-50 p-1.5 rounded transition-all hover:opacity-100 disabled:opacity-30"
                    style={{ color: colors.text }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outbound Section */}
        <div>
          <h3
            className="mb-3 text-sm font-medium uppercase tracking-wide text-center"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              color: colors.text,
              opacity: 0.7,
            }}
          >
            Outbound
          </h3>
          {!stats.outboundCalls || stats.outboundCalls.length === 0 ? (
            <div className="text-center py-6" style={{ color: colors.text, opacity: 0.5 }}>
              No outbound calls
            </div>
          ) : (
            <div className="space-y-2">
              {stats.outboundCalls.map((call) => (
                <div
                  key={call.id}
                  className="group flex items-start gap-4 p-4 rounded-lg transition-all mx-auto"
                  style={{
                    backgroundColor: `${colors.accent}08`,
                    border: `1px solid ${colors.accent}20`,
                    maxWidth: '100%',
                  }}
                >
                  <div className="flex-1 min-w-0 text-center">
                    <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.accent }}
                      >
                        {call.callerName || formatPhone(call.callerPhone)}
                      </span>
                      <span
                        className="text-xs whitespace-nowrap"
                        style={{ color: colors.text, opacity: 0.5 }}
                      >
                        {formatTimestamp(call.timestamp)}
                      </span>
                      {call.callDuration && (
                        <span
                          className="text-xs whitespace-nowrap"
                          style={{ color: colors.text, opacity: 0.5 }}
                        >
                          {formatDuration(call.callDuration)}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm leading-relaxed text-center"
                      style={{
                        color: colors.text,
                        opacity: 0.8,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      {call.note}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(call.id)}
                    disabled={deletingId === call.id}
                    className="opacity-0 group-hover:opacity-50 p-1.5 rounded transition-all hover:opacity-100 disabled:opacity-30"
                    style={{ color: colors.text }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


