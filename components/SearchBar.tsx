'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { Search, X } from 'lucide-react';

interface SearchResult {
  id: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp: string;
  snippet: string;
}

interface SearchBarProps {
  recordId: string;
  onResultClick: (result: SearchResult) => void;
  onClose: () => void;
}

export default function SearchBar({ recordId, onResultClick, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/chat/search?recordId=${recordId}&q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setResults(data.results || []);
          }
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(searchTimeout);
  }, [query, recordId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl"
        style={{
          backgroundColor: colors.primary,
          border: `1px solid ${colors.accent}30`,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: `${colors.accent}20` }}>
          <Search size={20} style={{ color: colors.accent, opacity: 0.7 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            autoFocus
            className="flex-1 bg-transparent outline-none"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '16px',
            }}
          />
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{
              color: colors.text,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-5 py-8 text-center" style={{ color: colors.text, opacity: 0.5 }}>
              Searching...
            </div>
          ) : results.length === 0 && query.trim().length >= 2 ? (
            <div className="px-5 py-8 text-center" style={{ color: colors.text, opacity: 0.5 }}>
              No results found
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-8 text-center" style={{ color: colors.text, opacity: 0.5 }}>
              Type at least 2 characters to search
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  onResultClick(result);
                  onClose();
                }}
                className="w-full text-left px-5 py-3 transition-all hover:bg-white/5"
                style={{
                  borderLeft: `3px solid ${result.role === 'user' ? colors.accent : 'transparent'}`,
                }}
              >
                <div
                  className="text-sm mb-1"
                  style={{
                    color: colors.text,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {result.snippet}
                </div>
                <div
                  className="text-xs"
                  style={{
                    color: colors.text,
                    opacity: 0.5,
                  }}
                >
                  {new Date(result.timestamp).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}




