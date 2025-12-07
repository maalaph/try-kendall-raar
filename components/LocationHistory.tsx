'use client';

/**
 * Location History Component
 * Timeline view of recent location check-ins
 */

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

export interface LocationHistoryItem {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  label?: string;
  source?: string;
  createdAt: string;
  accuracy?: number;
}

interface LocationHistoryProps {
  userId: string;
  onItemClick?: (item: LocationHistoryItem) => void;
  className?: string;
}

export default function LocationHistory({
  userId,
  onItemClick,
  className = '',
}: LocationHistoryProps) {
  const [history, setHistory] = useState<LocationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchHistory();
  }, [userId, dateFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        userId,
        type: 'history',
        limit: '50',
      });
      
      const response = await fetch(`/api/location?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch location history');
      }
      
      const data = await response.json();
      let locations = data.locations || [];
      
      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (dateFilter) {
          case 'today':
            filterDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            filterDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        locations = locations.filter((loc: LocationHistoryItem) => {
          const locDate = new Date(loc.createdAt);
          return locDate >= filterDate;
        });
      }
      
      setHistory(locations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className={`p-8 text-center ${className}`} style={{ color: colors.text, opacity: 0.6 }}>
        <p className="text-sm">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 text-center ${className}`} style={{ color: '#ef4444' }}>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`} style={{ color: colors.text, opacity: 0.6 }}>
        <p className="text-sm">No location history found.</p>
        <p className="text-xs mt-2">Location check-ins will appear here.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Date filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'today', 'week', 'month'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setDateFilter(filter)}
            className="px-3 py-1.5 text-xs rounded transition-colors capitalize"
            style={{
              backgroundColor: dateFilter === filter ? colors.accent : colors.secondary,
              color: dateFilter === filter ? colors.primary : colors.text,
              border: `1px solid ${dateFilter === filter ? colors.accent : colors.secondary}`,
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* History timeline */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {history.map((item, index) => {
          const isFirstOfDay = index === 0 || 
            new Date(item.createdAt).toDateString() !== 
            new Date(history[index - 1].createdAt).toDateString();
          
          return (
            <div key={item.id}>
              {isFirstOfDay && (
                <div
                  className="text-xs font-medium mb-2 mt-4 first:mt-0"
                  style={{ color: colors.text, opacity: 0.5 }}
                >
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              )}
              
              <div
                onClick={() => onItemClick?.(item)}
                className="p-3 rounded-lg transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: colors.secondary,
                  border: `1px solid ${colors.secondary}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.backgroundColor = `${colors.accent}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.secondary;
                  e.currentTarget.style.backgroundColor = colors.secondary;
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📍</span>
                      <div className="flex-1 min-w-0">
                        {item.label && (
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: colors.text }}
                          >
                            {item.label}
                          </p>
                        )}
                        {item.address ? (
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: colors.text, opacity: 0.7 }}
                          >
                            {item.address}
                          </p>
                        ) : (
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: colors.text, opacity: 0.5 }}
                          >
                            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 text-right">
                    <p
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.6 }}
                    >
                      {formatTime(item.createdAt)}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: colors.text, opacity: 0.5 }}
                    >
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
                
                {item.source && (
                  <div className="mt-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${colors.accent}20`,
                        color: colors.accent,
                      }}
                    >
                      {item.source}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

