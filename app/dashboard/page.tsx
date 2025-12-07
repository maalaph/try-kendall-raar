'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatNavbar from '@/components/ChatNavbar';
import IntegrationDashboard from '@/components/IntegrationDashboard';
import LocationSuggestionCard, { LocationSuggestion } from '@/components/LocationSuggestionCard';
import { colors } from '@/lib/config';

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

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

  useEffect(() => {
    if (recordId) {
      fetchLocationSuggestions();
    }
  }, [recordId]);

  const fetchLocationSuggestions = async () => {
    if (!recordId) return;
    
    setLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/location/suggestions?userId=${recordId}&status=pending`);
      if (response.ok) {
        const data = await response.json();
        setLocationSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch location suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string, customLabel: string) => {
    if (!recordId) return;

    try {
      const response = await fetch('/api/location/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          userId: recordId,
          action: 'accept',
          customLabel,
        }),
      });

      if (response.ok) {
        await fetchLocationSuggestions();
      } else {
        throw new Error('Failed to accept suggestion');
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      alert('Failed to accept suggestion. Please try again.');
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    if (!recordId) return;

    try {
      const response = await fetch('/api/location/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          userId: recordId,
          action: 'reject',
        }),
      });

      if (response.ok) {
        await fetchLocationSuggestions();
      } else {
        throw new Error('Failed to reject suggestion');
      }
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      alert('Failed to reject suggestion. Please try again.');
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    if (!recordId) return;

    try {
      const response = await fetch('/api/location/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          userId: recordId,
          action: 'dismiss',
        }),
      });

      if (response.ok) {
        await fetchLocationSuggestions();
      }
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
      // Don't show error for dismiss, just remove from list
      await fetchLocationSuggestions();
    }
  };

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
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Location Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium" style={{ color: colors.text }}>
                Locations
              </h2>
              <button
                onClick={() => router.push(`/dashboard/location?recordId=${recordId}`)}
                className="px-4 py-2 text-sm rounded transition-colors font-medium"
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
                View Map & Manage →
              </button>
            </div>

            {/* Location Suggestions */}
            {!loadingSuggestions && locationSuggestions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locationSuggestions.slice(0, 3).map((suggestion) => (
                  <LocationSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAccept={handleAcceptSuggestion}
                    onReject={handleRejectSuggestion}
                    onDismiss={handleDismissSuggestion}
                  />
                ))}
              </div>
            )}

            {!loadingSuggestions && locationSuggestions.length === 0 && (
              <div
                className="p-6 rounded-xl text-center"
                style={{
                  backgroundColor: colors.secondary,
                  border: `1px solid ${colors.secondary}`,
                }}
              >
                <p className="text-sm mb-3" style={{ color: colors.text, opacity: 0.8 }}>
                  No location suggestions yet. Visit the map to add your locations!
                </p>
                <button
                  onClick={() => router.push(`/dashboard/location?recordId=${recordId}`)}
                  className="px-4 py-2 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.primary,
                  }}
                >
                  Open Location Map
                </button>
              </div>
            )}
          </div>

          {/* Integration Dashboard */}
          <IntegrationDashboard recordId={recordId} />
        </div>
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

