'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatNavbar from '@/components/ChatNavbar';
import GoogleAccountConnection from '@/components/GoogleAccountConnection';
import SpotifyConnection from '@/components/SpotifyConnection';
import { colors } from '@/lib/config';

function IntegrationsPageContent() {
  const searchParams = useSearchParams();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get recordId from URL or localStorage
    const urlRecordId = searchParams?.get('recordId');
    const storedRecordId = typeof window !== 'undefined' 
      ? localStorage.getItem('myKendallRecordId') 
      : null;
    
    const finalRecordId = urlRecordId || storedRecordId;
    
    if (finalRecordId) {
      setRecordId(finalRecordId);
      setLoading(false);
      // Store in localStorage if from URL
      if (urlRecordId && typeof window !== 'undefined') {
        localStorage.setItem('myKendallRecordId', urlRecordId);
      }
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading || !recordId) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          paddingTop: '80px',
        }}
      >
        <div style={{ color: colors.text, opacity: 0.6 }}>
          {loading ? 'Loading...' : 'Please provide a recordId parameter or visit from your edit link'}
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: colors.primary,
        paddingTop: '100px', // Space for fixed navbar
      }}
    >
      <ChatNavbar recordId={recordId} />
      
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1
            className="mb-8"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '2rem',
              fontWeight: 700,
              color: colors.text,
            }}
          >
            Integrations
          </h1>
          <p
            className="mb-8"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '1rem',
              color: colors.text,
              opacity: 0.8,
            }}
          >
            Connect your accounts to enable additional features for Kendall.
          </p>
          
          <GoogleAccountConnection recordId={recordId} />
          
          <SpotifyConnection recordId={recordId} />
        </div>
      </div>
    </main>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          paddingTop: '80px',
        }}
      >
        <div style={{ color: colors.text, opacity: 0.6 }}>Loading...</div>
      </main>
    }>
      <IntegrationsPageContent />
    </Suspense>
  );
}

