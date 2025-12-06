-- Add missing columns to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system', 'call_request')),
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

