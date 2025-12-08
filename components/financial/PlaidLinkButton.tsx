'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { colors } from '@/lib/config';

interface PlaidLinkButtonProps {
  recordId: string;
  onSuccess?: (publicToken: string, metadata: any) => void;
  onExit?: () => void;
  className?: string;
}

// Global flag to prevent multiple script loads
// React Strict Mode causes double renders in development, this prevents duplicate scripts
let plaidScriptLoaded = false;

// Internal component that only renders when we have a token
// This prevents multiple script embeddings
function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}) {
  const config = useMemo(() => ({
    token,
    onSuccess,
    onExit,
  }), [token, onSuccess, onExit]);

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready && open && !plaidScriptLoaded) {
      plaidScriptLoaded = true;
      // Small delay to ensure Plaid Link is fully initialized
      const timer = setTimeout(() => {
        open();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ready, open]);

  return null; // This component doesn't render anything
}

export default function PlaidLinkButton({ 
  recordId, 
  onSuccess, 
  onExit,
  className = '' 
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Exchange public token
  const handleSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          recordId,
        }),
      });

      const data = await response.json();
      
      if (data.success && onSuccess) {
        onSuccess(publicToken, metadata);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error exchanging public token:', error);
      setLoading(false);
    }
  }, [recordId, onSuccess]);

  const handleExit = useCallback(() => {
    setLoading(false);
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  // Handle button click
  const handleClick = async () => {
    if (loading) return; // Prevent multiple clicks
    
    if (!linkToken) {
      try {
        setLoading(true);
        const response = await fetch(`/api/plaid/create-link-token?recordId=${recordId}`);
        const data = await response.json();
        
        if (data.link_token) {
          setLinkToken(data.link_token);
          // Plaid Link will auto-open via PlaidLinkLauncher when ready
        } else {
          console.error('Failed to create link token:', data.error);
          setLoading(false);
          alert(data.error || 'Failed to create link token. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching link token:', error);
        setLoading(false);
        alert('Error connecting to Plaid. Please try again.');
      }
    }
    // If linkToken already exists, PlaidLinkLauncher will handle opening
  };

  return (
    <>
      {/* Only render PlaidLinkLauncher when we have a token - prevents multiple script loads */}
      {linkToken && (
        <PlaidLinkLauncher
          token={linkToken}
          onSuccess={handleSuccess}
          onExit={handleExit}
        />
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`px-6 py-3 font-light rounded-sm transition-all duration-200 ${className}`}
        style={{
          backgroundColor: colors.accent,
          color: colors.text,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
          border: 'none',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}33`;
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        {loading ? 'Connecting...' : 'Connect Bank Account'}
      </button>
    </>
  );
}

