'use client';

import { useState, useEffect } from 'react';
import IntegrationCard from './IntegrationCard';
import { colors } from '@/lib/config';

interface DashboardData {
  calls: {
    connected: boolean;
    summary?: {
      totalCalls: number;
      unreadMessages: number;
      averageCallDuration: number;
      totalCallMinutes: number;
    };
    details?: {
      recentActivity: Array<{
        id: string;
        callerPhone: string;
        callerName?: string;
        note: string;
        timestamp: string;
        callDuration?: number;
        read: boolean;
      }>;
    };
    error?: {
      type: string;
      message?: string;
    };
  } | null;
  emails: {
    connected: boolean;
    summary?: {
      unreadCount: number;
      recentCount: number;
      mostFrequentSender: string | null;
    };
    details?: {
      unreadMessages: Array<{
        id: string;
        from: string;
        subject: string;
        date: string;
      }>;
      recentMessages: Array<{
        id: string;
        from: string;
        subject: string;
        date: string;
      }>;
    };
    error?: {
      type: string;
      message?: string;
    };
  } | null;
  spotify: {
    connected: boolean;
    summary?: {
      topArtist: string | null;
      topTrack: string | null;
      mood: string | null;
    };
    details?: {
      topArtists: Array<{
        id: string;
        name: string;
      }>;
      topTracks: Array<{
        id: string;
        name: string;
        artists?: Array<{ name: string }>;
      }>;
      mood: {
        label: string;
        description?: string;
      } | null;
    };
    error?: {
      type: string;
      message?: string;
    };
  } | null;
}

interface IntegrationDashboardProps {
  recordId: string;
}

export default function IntegrationDashboard({ recordId }: IntegrationDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<'calls' | 'emails' | 'spotify' | null>(null);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/dashboard?recordId=${encodeURIComponent(recordId)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result);
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [recordId]);

  const handleCardToggle = (type: 'calls' | 'emails' | 'spotify') => {
    setExpandedCard(expandedCard === type ? null : type);
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
        <div style={{ color: colors.text, opacity: 0.6 }}>Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div style={{ color: colors.text, opacity: 0.6 }}>Failed to load dashboard data</div>
      </div>
    );
  }

  // Prepare summary data for each card
  const callsSummary = data.calls?.summary
    ? {
        primary: `${data.calls.summary.totalCalls} calls`,
        secondary: `${data.calls.summary.unreadMessages} unread`,
        tertiary: `Avg: ${formatDuration(data.calls.summary.averageCallDuration)}`,
      }
    : {
        primary: 'No data',
        secondary: 'Unable to load calls',
      };

  const emailsSummary = data.emails?.summary
    ? {
        primary: `${data.emails.summary.unreadCount} unread`,
        secondary: `${data.emails.summary.recentCount} recent`,
        tertiary: data.emails.summary.mostFrequentSender
          ? `Most: ${data.emails.summary.mostFrequentSender.split('<')[0].trim()}`
          : undefined,
      }
    : {
        primary: 'No data',
        secondary: data.emails?.error?.type === 'not_connected' ? 'Not connected' : 'Unable to load emails',
      };

  const spotifySummary = data.spotify?.summary
    ? {
        primary: data.spotify.summary.topArtist || 'No data',
        secondary: data.spotify.summary.topTrack ? `Top track: ${data.spotify.summary.topTrack}` : undefined,
        tertiary: data.spotify.summary.mood ? `Mood: ${data.spotify.summary.mood}` : undefined,
      }
    : {
        primary: 'No data',
        secondary: data.spotify?.error?.type === 'not_connected' ? 'Not connected' : 'Unable to load Spotify',
      };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      <h1
        className="mb-8 text-center"
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '2rem',
          fontWeight: 700,
          color: colors.text,
        }}
      >
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Calls Card */}
        <IntegrationCard
          type="calls"
          title="Calls"
          summary={callsSummary}
          details={data.calls?.details}
          isExpanded={expandedCard === 'calls'}
          onToggle={() => handleCardToggle('calls')}
          connected={data.calls?.connected ?? false}
          error={data.calls?.error}
        />

        {/* Emails Card */}
        <IntegrationCard
          type="emails"
          title="Emails"
          summary={emailsSummary}
          details={data.emails?.details}
          isExpanded={expandedCard === 'emails'}
          onToggle={() => handleCardToggle('emails')}
          connected={data.emails?.connected ?? false}
          error={data.emails?.error}
          connectUrl={`/integrations?recordId=${encodeURIComponent(recordId)}`}
        />

        {/* Spotify Card */}
        <IntegrationCard
          type="spotify"
          title="Spotify"
          summary={spotifySummary}
          details={data.spotify?.details}
          isExpanded={expandedCard === 'spotify'}
          onToggle={() => handleCardToggle('spotify')}
          connected={data.spotify?.connected ?? false}
          error={data.spotify?.error}
          connectUrl={`/integrations?recordId=${encodeURIComponent(recordId)}`}
        />
      </div>
    </div>
  );
}

