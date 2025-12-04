'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';
import { FileText, X } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  content: string;
  category?: string;
}

interface TemplatePickerProps {
  recordId: string;
  onSelect: (template: Template, rendered: string) => void;
  category?: string;
  className?: string;
}

export default function TemplatePicker({ 
  recordId, 
  onSelect,
  category,
  className = ''
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!recordId) return;

      try {
        setLoading(true);
        const params = new URLSearchParams({ recordId });
        if (category) params.append('category', category);

        const response = await fetch(`/api/chat/templates?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.templates) {
            setTemplates(data.templates);
          }
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isExpanded) {
      fetchTemplates();
    }
  }, [recordId, category, isExpanded]);

  const handleTemplateSelect = (template: Template) => {
    // Render template (could prompt for variables, but for now just use as-is)
    onSelect(template, template.content);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`${className} flex items-center gap-2 px-3 py-2 rounded-lg transition-all`}
        style={{
          backgroundColor: `${colors.accent}15`,
          border: `1px solid ${colors.accent}40`,
          color: colors.text,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${colors.accent}25`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `${colors.accent}15`;
        }}
      >
        <FileText size={16} />
        <span className="text-sm">Templates</span>
      </button>
    );
  }

  return (
    <div
      className={`${className} animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: `${colors.accent}10`,
          border: `1px solid ${colors.accent}30`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={18} style={{ color: colors.accent }} />
            <span
              className="text-sm font-medium"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              Message Templates
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded-lg transition-all hover:bg-white/5"
            style={{ color: colors.text, opacity: 0.6 }}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-4 text-center" style={{ color: colors.text, opacity: 0.6 }}>
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="py-4 text-center" style={{ color: colors.text, opacity: 0.6 }}>
            No templates available
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="w-full text-left p-3 rounded-lg transition-all"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: `1px solid ${colors.accent}30`,
                  color: colors.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.borderColor = `${colors.accent}30`;
                }}
              >
                <div
                  className="font-medium mb-1"
                  style={{
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontSize: '14px',
                  }}
                >
                  {template.name}
                </div>
                <div
                  className="text-xs"
                  style={{
                    color: colors.text,
                    opacity: 0.7,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {template.content.substring(0, 60)}...
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




