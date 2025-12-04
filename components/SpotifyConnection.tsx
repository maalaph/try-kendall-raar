'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

interface SpotifyConnectionProps {
  recordId: string;
}

interface SpotifyConnectionStatus {
  connected: boolean;
  userId: string | null;
  displayName: string | null;
  email: string | null;
}

export default function SpotifyConnection({ recordId }: SpotifyConnectionProps) {
  const [status, setStatus] = useState<SpotifyConnectionStatus | null>(null);
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
      const response = await fetch(`/api/auth/spotify/status?recordId=${encodeURIComponent(recordId)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[SPOTIFY CONNECTION] Status fetched:', data);
        setStatus({
          connected: data.connected || false,
          userId: data.userId || null,
          displayName: data.displayName || null,
          email: data.email || null,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[SPOTIFY CONNECTION] Status check failed:', response.status, errorData);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = `/api/auth/spotify/authorize?recordId=${encodeURIComponent(recordId)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Spotify account? This will remove access to your music data and recommendations.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch(`/api/auth/spotify/disconnect?recordId=${encodeURIComponent(recordId)}`, {
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

  const isConnected = status?.connected || false;

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
          Spotify
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
          {status?.displayName && (
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-2.04-8.159-2.16-11.939-1.26-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.02 18.72 12.84c.361.181.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span style={{ color: colors.text, opacity: 0.9 }}>
                Connected as: <strong>{status.displayName}</strong>
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <span style={{ color: colors.accent }}>✓ Spotify Connected</span>
          </div>
          
          <p style={{ color: colors.text, opacity: 0.8, fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Kendall can now recommend music, analyze your listening habits, and learn from your music preferences.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p style={{ color: colors.text, opacity: 0.8 }}>
            Connect your Spotify account to enable music recommendations, listening analytics, and mood-based suggestions.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-6 py-3 rounded-lg font-medium transition-opacity flex items-center gap-2"
            style={{
              backgroundColor: '#1DB954',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {connecting ? (
              'Connecting...'
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-2.04-8.159-2.16-11.939-1.26-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.02 18.72 12.84c.361.181.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Connect Spotify
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}



