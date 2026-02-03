-- CHAT SYSTEM: Group chat for Rene, Ethan, and Eli
-- Run this in your Supabase SQL editor

-- ============================================
-- CHAT MESSAGES TABLE
-- Stores all group chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who sent the message
  user_id UUID NOT NULL REFERENCES users(id),

  -- Message content
  content TEXT NOT NULL,

  -- Media support (images and links)
  media_url TEXT,           -- URL to image/media
  media_type TEXT,          -- 'image', 'link', null
  link_preview JSONB,       -- {title, description, image} for link previews

  -- Threading (for replies within chat)
  reply_to_id UUID REFERENCES chat_messages(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- ============================================
-- Add chat memory type to existing memories
-- ============================================
-- No schema change needed - bot_memories already supports custom memory_type values
-- We'll use 'chat_conversation' for chat-related memories

