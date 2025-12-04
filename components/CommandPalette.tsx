'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { colors } from '@/lib/config';
import { Search, Command, Phone, Calendar, MessageSquare, File, Clock } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'action' | 'contact' | 'conversation' | 'quick';
  keywords?: string[];
}

interface CommandPaletteProps {
  recordId: string;
  onActionSelect: (action: string, data?: Record<string, any>) => void;
  conversations?: Array<{ id: string; preview: string; timestamp: string }>;
  contacts?: Array<{ id: string; name: string; phone?: string }>;
  assistantName?: string;
}

export default function CommandPalette({
  recordId,
  onActionSelect,
  conversations = [],
  contacts = [],
  assistantName = 'Kendall',
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command items - use useMemo to prevent infinite loops
  const commands = useMemo((): CommandItem[] => {
    const commandList: CommandItem[] = [
      // Quick Actions
      {
        id: 'make-call',
        label: 'Make Call',
        description: 'Start a phone call',
        icon: <Phone size={18} />,
        action: () => {
          onActionSelect('make-call');
          setIsOpen(false);
        },
        category: 'quick',
        keywords: ['call', 'phone', 'dial'],
      },
      {
        id: 'schedule-call',
        label: 'Schedule Call',
        description: 'Schedule a call for later',
        icon: <Clock size={18} />,
        action: () => {
          onActionSelect('schedule-call');
          setIsOpen(false);
        },
        category: 'quick',
        keywords: ['schedule', 'later', 'remind'],
      },
      {
        id: 'check-schedule',
        label: 'Check Schedule',
        description: 'View your calendar',
        icon: <Calendar size={18} />,
        action: () => {
          onActionSelect('check-schedule');
          setIsOpen(false);
        },
        category: 'quick',
        keywords: ['schedule', 'calendar', 'appointments'],
      },
      {
        id: 'send-message',
        label: 'Send Message',
        description: 'Send a text message',
        icon: <MessageSquare size={18} />,
        action: () => {
          onActionSelect('send-message');
          setIsOpen(false);
        },
        category: 'quick',
        keywords: ['message', 'text', 'sms'],
      },
      {
        id: 'upload-file',
        label: 'Upload File',
        description: 'Upload a document or image',
        icon: <File size={18} />,
        action: () => {
          onActionSelect('upload-file');
          setIsOpen(false);
        },
        category: 'quick',
        keywords: ['file', 'upload', 'document'],
      },
    ];

    // Add contacts
    contacts.forEach((contact) => {
      commandList.push({
        id: `contact-${contact.id}`,
        label: contact.name,
        description: contact.phone ? `Call ${contact.phone}` : 'Contact',
        icon: <Phone size={18} />,
        action: () => {
          onActionSelect('call-contact', { name: contact.name, phone: contact.phone });
          setIsOpen(false);
        },
        category: 'contact',
        keywords: [contact.name.toLowerCase(), contact.phone || ''],
      });
    });

    // Add recent conversations
    conversations.slice(0, 5).forEach((conv) => {
      commandList.push({
        id: `conv-${conv.id}`,
        label: conv.preview.substring(0, 50),
        description: `Conversation from ${new Date(conv.timestamp).toLocaleDateString()}`,
        icon: <MessageSquare size={18} />,
        action: () => {
          onActionSelect('view-conversation', { id: conv.id });
          setIsOpen(false);
        },
        category: 'conversation',
        keywords: [conv.preview.toLowerCase()],
      });
    });

    return commandList;
  }, [onActionSelect, contacts, conversations]);

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some((k) => k.includes(query))
    );
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }

      // Arrow keys navigation
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          e.preventDefault();
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsOpen(false);
          setSearchQuery('');
        }
      }}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: colors.primary,
          border: `1px solid ${colors.accent}30`,
          maxHeight: '70vh',
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
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commands, contacts, conversations..."
            className="flex-1 bg-transparent outline-none"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '16px',
            }}
          />
          <div
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: `${colors.accent}15`,
              color: colors.text,
              opacity: 0.6,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            <Command size={12} className="inline mr-1" />
            K
          </div>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.accent}40 transparent`,
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              className="px-5 py-8 text-center"
              style={{
                color: colors.text,
                opacity: 0.5,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              No results found
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                onClick={command.action}
                className="w-full text-left px-5 py-3 transition-all"
                style={{
                  backgroundColor: index === selectedIndex ? `${colors.accent}15` : 'transparent',
                  borderLeft: index === selectedIndex ? `3px solid ${colors.accent}` : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-start gap-3">
                  <div style={{ color: colors.accent, marginTop: '2px' }}>
                    {command.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium mb-1"
                      style={{
                        color: colors.text,
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontSize: '15px',
                      }}
                    >
                      {command.label}
                    </div>
                    {command.description && (
                      <div
                        className="text-sm"
                        style={{
                          color: colors.text,
                          opacity: 0.6,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        {command.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between text-xs"
          style={{
            borderColor: `${colors.accent}20`,
            color: colors.text,
            opacity: 0.5,
            fontFamily: 'var(--font-inter), sans-serif',
          }}
        >
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>{filteredCommands.length} result{filteredCommands.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}


