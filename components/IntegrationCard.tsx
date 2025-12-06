'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';
import { Phone, Mail, Music, ChevronDown, ExternalLink } from 'lucide-react';

export type IntegrationType = 'calls' | 'emails' | 'spotify';

interface IntegrationCardProps {
  type: IntegrationType;
  title: string;
  summary: {
    primary: string;
    secondary?: string;
    tertiary?: string;
  };
  details?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  connected: boolean;
  error?: {
    type: 'not_connected' | 'error' | 'unknown';
    message?: string;
  };
  connectUrl?: string;
}

export default function IntegrationCard({
  type,
  title,
  summary,
  details,
  isExpanded,
  onToggle,
  connected,
  error,
  connectUrl,
}: IntegrationCardProps) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const [detailsHeight, setDetailsHeight] = useState<number | 'auto'>('auto');

  // Calculate height for smooth animation
  useEffect(() => {
    if (detailsRef.current) {
      if (isExpanded) {
        setDetailsHeight(detailsRef.current.scrollHeight);
      } else {
        setDetailsHeight(0);
      }
    }
  }, [isExpanded, details]);

  // Update height when content changes
  useEffect(() => {
    if (isExpanded && detailsRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (detailsRef.current) {
          setDetailsHeight(detailsRef.current.scrollHeight);
        }
      });
      resizeObserver.observe(detailsRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isExpanded]);

  const getIcon = () => {
    const iconProps = { size: 24, style: { color: colors.accent } };
    switch (type) {
      case 'calls':
        return <Phone {...iconProps} />;
      case 'emails':
        return <Mail {...iconProps} />;
      case 'spotify':
        return <Music {...iconProps} />;
      default:
        return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Render details based on type
  const renderDetails = () => {
    if (!connected || error) {
      return (
        <div className="py-6 text-center">
          <p style={{ color: colors.text, opacity: 0.6, marginBottom: '1rem' }}>
            {error?.type === 'not_connected'
              ? 'Integration not connected'
              : error?.message || 'Unable to load data'}
          </p>
          {connectUrl && (
            <a
              href={connectUrl}
              className="inline-block px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
                textDecoration: 'none',
                fontFamily: 'var(--font-inter), sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Connect <ExternalLink size={14} style={{ display: 'inline', marginLeft: '4px' }} />
            </a>
          )}
        </div>
      );
    }

    if (!details) {
      return (
        <div className="py-6 text-center" style={{ color: colors.text, opacity: 0.6 }}>
          No details available
        </div>
      );
    }

    // If details is already a React node, render it
    if (typeof details === 'object' && 'type' in details) {
      return details;
    }

    // Otherwise, render based on type
    switch (type) {
      case 'calls':
        return renderCallsDetails(details as any);
      case 'emails':
        return renderEmailsDetails(details as any);
      case 'spotify':
        return renderSpotifyDetails(details as any);
      default:
        return null;
    }
  };

  const renderCallsDetails = (data: any) => {
    const activities = data?.recentActivity || [];
    return (
      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-4" style={{ color: colors.text, opacity: 0.5 }}>
            No recent activity
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity: any) => (
              <div
                key={activity.id}
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: `${colors.accent}08`,
                  border: `1px solid ${colors.accent}20`,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-sm font-medium"
                    style={{ color: colors.accent }}
                  >
                    {activity.callerName || formatPhone(activity.callerPhone)}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: colors.text, opacity: 0.5 }}
                  >
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: colors.text,
                    opacity: 0.8,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {activity.note}
                </p>
                {activity.callDuration && (
                  <span
                    className="text-xs mt-1 inline-block"
                    style={{ color: colors.text, opacity: 0.5 }}
                  >
                    Duration: {formatDuration(activity.callDuration)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEmailsDetails = (data: any) => {
    const unread = data?.unreadMessages || [];
    const recent = data?.recentMessages || [];
    
    return (
      <div className="space-y-4">
        {unread.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold mb-2"
              style={{ color: colors.accent }}
            >
              Unread ({unread.length})
            </h4>
            <div className="space-y-2">
              {unread.map((email: any) => (
                <div
                  key={email.id}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: `${colors.accent}15`,
                    border: `1px solid ${colors.accent}30`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: colors.text }}
                    >
                      {email.from}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.5 }}
                    >
                      {email.date ? new Date(email.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: colors.text,
                      opacity: 0.8,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {email.subject || '(No subject)'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {recent.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text, opacity: 0.7 }}
            >
              Recent
            </h4>
            <div className="space-y-2">
              {recent.slice(0, 5).map((email: any) => (
                <div
                  key={email.id}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: `${colors.accent}08`,
                    border: `1px solid ${colors.accent}20`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: colors.text, opacity: 0.9 }}
                    >
                      {email.from}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.5 }}
                    >
                      {email.date ? new Date(email.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p
                    className="text-sm"
                    style={{
                      color: colors.text,
                      opacity: 0.7,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {email.subject || '(No subject)'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {unread.length === 0 && recent.length === 0 && (
          <div className="text-center py-4" style={{ color: colors.text, opacity: 0.5 }}>
            No emails found
          </div>
        )}
      </div>
    );
  };

  const renderSpotifyDetails = (data: any) => {
    const topArtists = data?.topArtists || [];
    const topTracks = data?.topTracks || [];
    const mood = data?.mood;

    return (
      <div className="space-y-4">
        {mood && (
          <div
            className="p-4 rounded-lg text-center"
            style={{
              backgroundColor: `${colors.accent}10`,
              border: `1px solid ${colors.accent}25`,
            }}
          >
            <p
              className="text-sm mb-1"
              style={{ color: colors.text, opacity: 0.7 }}
            >
              Current Mood
            </p>
            <p
              className="text-lg font-semibold"
              style={{ color: colors.accent }}
            >
              {mood.label}
            </p>
            {mood.description && (
              <p
                className="text-xs mt-1"
                style={{ color: colors.text, opacity: 0.6 }}
              >
                {mood.description}
              </p>
            )}
          </div>
        )}

        {topArtists.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold mb-2"
              style={{ color: colors.accent }}
            >
              Top Artists
            </h4>
            <div className="space-y-1">
              {topArtists.map((artist: any, index: number) => (
                <div
                  key={artist.id || index}
                  className="p-2 rounded flex items-center gap-2"
                  style={{
                    backgroundColor: `${colors.accent}08`,
                  }}
                >
                  <span
                    className="text-xs w-6 text-center"
                    style={{ color: colors.text, opacity: 0.5 }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="text-sm flex-1"
                    style={{ color: colors.text }}
                  >
                    {artist.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topTracks.length > 0 && (
          <div>
            <h4
              className="text-sm font-semibold mb-2"
              style={{ color: colors.text, opacity: 0.7 }}
            >
              Top Tracks
            </h4>
            <div className="space-y-1">
              {topTracks.map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="p-2 rounded flex items-center gap-2"
                  style={{
                    backgroundColor: `${colors.accent}08`,
                  }}
                >
                  <span
                    className="text-xs w-6 text-center"
                    style={{ color: colors.text, opacity: 0.5 }}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="text-sm flex-1"
                    style={{ color: colors.text }}
                  >
                    {track.name}
                  </span>
                  {track.artists && track.artists.length > 0 && (
                    <span
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.5 }}
                    >
                      {track.artists[0].name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {topArtists.length === 0 && topTracks.length === 0 && (
          <div className="text-center py-4" style={{ color: colors.text, opacity: 0.5 }}>
            No listening data available
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="rounded-lg overflow-hidden transition-all cursor-pointer"
      style={{
        backgroundColor: `${colors.accent}10`,
        border: `1px solid ${colors.accent}25`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.accent;
        e.currentTarget.style.backgroundColor = `${colors.accent}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${colors.accent}25`;
        e.currentTarget.style.backgroundColor = `${colors.accent}10`;
      }}
    >
      {/* Card Header - Always Visible */}
      <div
        className="p-5"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3
              className="text-lg font-semibold"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              {title}
            </h3>
          </div>
          <ChevronDown
            size={20}
            style={{
              color: colors.accent,
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
            }}
          />
        </div>

        {/* Summary Metrics */}
        <div className="space-y-2">
          <div
            className="text-2xl font-semibold"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            {summary.primary}
          </div>
          {summary.secondary && (
            <div
              className="text-sm"
              style={{ color: colors.text, opacity: 0.7 }}
            >
              {summary.secondary}
            </div>
          )}
          {summary.tertiary && (
            <div
              className="text-xs"
              style={{ color: colors.text, opacity: 0.5 }}
            >
              {summary.tertiary}
            </div>
          )}
        </div>
      </div>

      {/* Expandable Details Section */}
      <div
        style={{
          height: isExpanded ? detailsHeight : 0,
          overflow: 'hidden',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          ref={detailsRef}
          className="px-5 pb-5"
          style={{
            borderTop: `1px solid ${colors.accent}20`,
            paddingTop: '1rem',
          }}
        >
          {renderDetails()}
        </div>
      </div>
    </div>
  );
}

