'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

interface GoogleAccountConnectionProps {
  recordId: string;
}

interface GoogleConnectionStatus {
  calendarConnected: boolean;
  gmailConnected: boolean;
  email: string | null;
}

export default function GoogleAccountConnection({ recordId }: GoogleAccountConnectionProps) {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchConnectionStatus();
    
    // Check for OAuth success/error in URL
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    
    if (oauthSuccess === 'true') {
      // Refresh status after successful connection - try multiple times with delays
      // Sometimes Airtable needs a moment to update
      setTimeout(() => fetchConnectionStatus(), 500);
      setTimeout(() => fetchConnectionStatus(), 2000);
      setTimeout(() => {
        fetchConnectionStatus();
        // Clean URL after final refresh
        window.history.replaceState({}, '', window.location.pathname + `?recordId=${recordId}`);
      }, 5000);
    }
    
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + `?recordId=${recordId}`);
    }
  }, [recordId]);

  const fetchConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auth/google/status?recordId=${encodeURIComponent(recordId)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[GOOGLE CONNECTION] Status fetched:', data);
        setStatus({
          calendarConnected: data.calendarConnected || false,
          gmailConnected: data.gmailConnected || false,
          email: data.email || null,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[GOOGLE CONNECTION] Status check failed:', response.status, errorData);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = `/api/auth/google/authorize?recordId=${encodeURIComponent(recordId)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? This will remove access to Calendar and Gmail.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch(`/api/auth/google/disconnect?recordId=${encodeURIComponent(recordId)}`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchConnectionStatus();
      } else {
        alert('Failed to disconnect. Please try again.');
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          backgroundColor: `${colors.accent}15`,
          border: `1px solid ${colors.accent}40`,
        }}
      >
        <div style={{ color: colors.text, opacity: 0.6 }}>Loading connection status...</div>
      </div>
    );
  }

  const isConnected = status?.calendarConnected || status?.gmailConnected;

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        backgroundColor: `${colors.accent}15`,
        border: `1px solid ${colors.accent}40`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Google Account
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConnectionStatus}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              backgroundColor: `${colors.accent}20`,
              color: colors.text,
              border: `1px solid ${colors.accent}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            title="Refresh connection status"
          >
            {loading ? '...' : '↻'}
          </button>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: `${colors.accent}30`,
                color: colors.text,
                border: `1px solid ${colors.accent}60`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          {status?.email && (
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span style={{ color: colors.text, opacity: 0.9 }}>
                Connected as: <strong>{status.email}</strong>
              </span>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {status?.calendarConnected ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span style={{ color: colors.accent }}>✓ Calendar Connected</span>
                </>
              ) : (
                <span style={{ color: colors.text, opacity: 0.6 }}>Calendar Not Connected</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {status?.gmailConnected ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span style={{ color: colors.accent }}>✓ Gmail Connected</span>
                </>
              ) : (
                <span style={{ color: colors.text, opacity: 0.6 }}>Gmail Not Connected</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p style={{ color: colors.text, opacity: 0.8 }}>
            Connect your Google account to enable Calendar and Gmail integration with Kendall.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-6 py-3 rounded-lg font-medium transition-opacity"
            style={{
              backgroundColor: colors.accent,
              color: colors.primary,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {connecting ? 'Connecting...' : 'Connect Google Account'}
          </button>
        </div>
      )}
    </div>
  );
}

