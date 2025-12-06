'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatNavbar from '@/components/ChatNavbar';
import IntegrationDashboard from '@/components/IntegrationDashboard';
import { colors } from '@/lib/config';

function DashboardPageContent() {
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
      // Store in localStorage if from URL
      if (urlRecordId && typeof window !== 'undefined') {
        localStorage.setItem('myKendallRecordId', urlRecordId);
      }
      setLoading(false);
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
      }}
    >
      <ChatNavbar recordId={recordId} />
      
      <div className="flex-1 overflow-y-auto" style={{ paddingTop: '100px' }}>
        <IntegrationDashboard recordId={recordId} />
      </div>
    </main>
  );
}

export default function DashboardPage() {
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
      <DashboardPageContent />
    </Suspense>
  );
}

