'use client';

import { colors } from '@/lib/config';
import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for chat messages
 * Supports: headings, bold, italic, lists, code blocks, links
 */
export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    const renderInlineMarkdown = (text: string): string => {
      let result = text;
      // Bold
      result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Inline code
      result = result.replace(/`(.*?)`/g, '<code>$1</code>');
      // Links
      result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: ' + colors.accent + '; text-decoration: underline;">$1</a>');
      return result;
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Start code block
          inCodeBlock = true;
          codeBlockLanguage = line.substring(3).trim();
          codeBlockContent = [];
        } else {
          // End code block
          inCodeBlock = false;
          const code = codeBlockContent.join('\n');
          elements.push(
            <pre
              key={`code-${index}`}
              className="my-3 p-4 rounded-lg overflow-x-auto"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: `1px solid ${colors.accent}30`,
                fontFamily: 'monospace',
                fontSize: '14px',
              }}
            >
              <code style={{ color: colors.text, whiteSpace: 'pre' }}>{code}</code>
            </pre>
          );
          codeBlockContent = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headings
      if (line.startsWith('## ')) {
        const text = renderInlineMarkdown(line.substring(3));
        elements.push(
          <h2
            key={`h2-${index}`}
            className="mt-4 mb-2 font-semibold"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '18px',
              fontWeight: 600,
            }}
            dangerouslySetInnerHTML={{ __html: text }}
          />
        );
        return;
      }

      if (line.startsWith('### ')) {
        const text = renderInlineMarkdown(line.substring(4));
        elements.push(
          <h3
            key={`h3-${index}`}
            className="mt-3 mb-2 font-semibold"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '16px',
              fontWeight: 600,
            }}
            dangerouslySetInnerHTML={{ __html: text }}
          />
        );
        return;
      }

      // Lists - handle in separate pass
      // For now, treat as regular text and process lists later
      
      // Empty line
      if (line.trim() === '') {
        elements.push(<br key={`br-${index}`} />);
        return;
      }

      // Regular paragraph
      const text = renderInlineMarkdown(line);
      elements.push(
        <p
          key={`p-${index}`}
          className="mb-2"
          style={{
            color: colors.text,
            fontFamily: 'var(--font-inter), sans-serif',
            lineHeight: '1.6',
          }}
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    });

    // Handle remaining code block if not closed
    if (inCodeBlock && codeBlockContent.length > 0) {
      const code = codeBlockContent.join('\n');
      elements.push(
        <pre
          key="code-final"
          className="my-3 p-4 rounded-lg overflow-x-auto"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: `1px solid ${colors.accent}30`,
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          <code style={{ color: colors.text, whiteSpace: 'pre' }}>{code}</code>
        </pre>
      );
    }

    return elements;
  }, [content]);

  // Process lists separately
  const finalRendered = useMemo(() => {
    if (rendered.length === 0) return null;

    // Simple approach: render as-is for now
    // Lists will work but won't be grouped
    return rendered;
  }, [rendered]);

  if (!content) return null;

  // Check if content looks like markdown
  const hasMarkdown = content.includes('##') || content.includes('###') || content.includes('```') || 
                     content.includes('**') || content.includes('*') || content.includes('[');

  if (!hasMarkdown) {
    return (
      <div className={className}>
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {finalRendered && finalRendered.length > 0 ? finalRendered : <div className="whitespace-pre-wrap">{content}</div>}
    </div>
  );
}
