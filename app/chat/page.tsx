'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatNavbar from '@/components/ChatNavbar';
import ChatInterface from '@/components/ChatInterface';
import ChatListSidebar from '@/components/ChatListSidebar';
import { colors } from '@/lib/config';

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hide main navbar on chat page
  useEffect(() => {
    const mainNavbar = document.getElementById('main-navbar');
    if (mainNavbar) {
      mainNavbar.style.display = 'none';
    }
    return () => {
      if (mainNavbar) {
        mainNavbar.style.display = 'block';
      }
    };
  }, []);

  useEffect(() => {
    // Get recordId from URL or localStorage
    const urlRecordId = searchParams?.get('recordId');
    const urlThreadId = searchParams?.get('threadId');
    const storedRecordId = typeof window !== 'undefined' 
      ? localStorage.getItem('myKendallRecordId') 
      : null;
    
    const finalRecordId = urlRecordId || storedRecordId;
    
    if (finalRecordId) {
      setRecordId(finalRecordId);
      // Always update threadId from URL (even if null) to handle thread switching
      setThreadId(urlThreadId || null);
      // Store in localStorage if from URL
      if (urlRecordId && typeof window !== 'undefined') {
        localStorage.setItem('myKendallRecordId', urlRecordId);
      }
      setLoading(false); // ✅ Fix: Set loading to false after recordId is found
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
        paddingTop: '100px', // Increased space for fixed navbar
      }}
    >
      <ChatNavbar recordId={recordId} />
      
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 100px)' }}>
        {/* Chat Threads Sidebar */}
        <div className="flex-shrink-0">
          <ChatListSidebar recordId={recordId} currentThreadId={threadId} />
        </div>

        {/* Chat Interface - Main Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatInterface recordId={recordId} threadId={threadId || undefined} />
        </div>
      </div>
    </main>
  );
}

export default function ChatPage() {
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
      <ChatPageContent />
    </Suspense>
  );
}
