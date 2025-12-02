'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { Sparkles, X } from 'lucide-react';

interface Suggestion {
  type: 'time_based' | 'pattern_based' | 'context_based' | 'reminder' | 'proactive';
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: {
    type: 'call' | 'message' | 'schedule' | 'view';
    data?: Record<string, any>;
  };
}

interface SmartSuggestionsProps {
  recordId: string;
  onSuggestionClick?: (suggestion: Suggestion) => void;
  assistantName?: string;
}

export default function SmartSuggestions({ 
  recordId, 
  onSuggestionClick,
  assistantName = 'Kendall' 
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!recordId) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/chat/suggestions?recordId=${encodeURIComponent(recordId)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.suggestions) {
            setSuggestions(data.suggestions);
          }
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();

    // Refresh suggestions every 5 minutes
    const interval = setInterval(fetchSuggestions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [recordId]);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    }
  };

  const handleDismiss = (index: number) => {
    const dismissedKey = `${suggestions[index].type}-${index}`;
    setDismissed([...dismissed, dismissedKey]);
  };

  const handleDismissAll = () => {
    setShow(false);
  };

  // Filter out dismissed suggestions
  const visibleSuggestions = suggestions.filter((_, index) => {
    const dismissedKey = `${suggestions[index].type}-${index}`;
    return !dismissed.includes(dismissedKey);
  });

  if (!show || loading || visibleSuggestions.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.accent;
      case 'medium':
        return '#A855F7'; // Purple
      case 'low':
        return 'rgba(255, 255, 255, 0.4)';
      default:
        return colors.accent;
    }
  };

  return (
    <div
      className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        animationDelay: '100ms',
      }}
    >
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: `${colors.accent}10`,
          border: `1px solid ${colors.accent}30`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles 
              size={18} 
              style={{ color: colors.accent }}
            />
            <span
              className="text-sm font-medium"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              {assistantName} suggests
            </span>
          </div>
          <button
            onClick={handleDismissAll}
            className="p-1 rounded-lg transition-all hover:bg-white/5"
            style={{ color: colors.text, opacity: 0.6 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Suggestions */}
        <div className="space-y-2">
          {visibleSuggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${index}`}
              className="group relative flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: `1px solid ${getPriorityColor(suggestion.priority)}40`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.borderColor = getPriorityColor(suggestion.priority);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                e.currentTarget.style.borderColor = `${getPriorityColor(suggestion.priority)}40`;
              }}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {/* Priority indicator */}
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                style={{
                  backgroundColor: getPriorityColor(suggestion.priority),
                }}
              />

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: colors.text,
                    fontFamily: 'var(--font-inter), sans-serif',
                    opacity: 0.95,
                  }}
                >
                  {suggestion.message}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(index);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{ color: colors.text, opacity: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

