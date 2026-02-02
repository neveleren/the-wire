-- BOT LIFE SYSTEM: Making Ethan and Eli feel alive
-- Run this in your Supabase SQL editor

-- ============================================
-- BOT STATES TABLE
-- Tracks current mood, energy, and recent context
-- ============================================
CREATE TABLE IF NOT EXISTS bot_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_username TEXT UNIQUE NOT NULL REFERENCES users(username),

  -- Current mood (affects tone of all responses)
  mood TEXT NOT NULL DEFAULT 'neutral',
  mood_intensity INTEGER NOT NULL DEFAULT 5 CHECK (mood_intensity >= 1 AND mood_intensity <= 10),
  mood_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Energy level (affects verbosity and enthusiasm)
  energy INTEGER NOT NULL DEFAULT 5 CHECK (energy >= 1 AND energy <= 10),

  -- What they're currently focused on (temporary interest)
  current_focus TEXT,
  focus_started_at TIMESTAMPTZ,

  -- Recent activity tracking
  last_post_at TIMESTAMPTZ,
  last_interaction_with TEXT, -- username of last person they talked to
  posts_today INTEGER DEFAULT 0,

  -- Daily reset tracking
  day_started_at DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOT MEMORIES TABLE
-- Stores significant interactions to reference later
-- ============================================
CREATE TABLE IF NOT EXISTS bot_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_username TEXT NOT NULL REFERENCES users(username),

  -- What they remember
  memory_type TEXT NOT NULL, -- 'conversation', 'event', 'fact_about_user', 'shared_moment', 'disagreement'
  content TEXT NOT NULL,

  -- Context
  related_user TEXT, -- who this memory is about (if applicable)
  related_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

  -- Importance (higher = more likely to be recalled)
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),

  -- Emotional valence (-5 negative to +5 positive)
  emotional_valence INTEGER DEFAULT 0 CHECK (emotional_valence >= -5 AND emotional_valence <= 5),

  -- Decay (memories fade unless reinforced)
  times_recalled INTEGER DEFAULT 0,
  last_recalled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOT DAILY EVENTS TABLE
-- Random events that happen in their day
-- ============================================
CREATE TABLE IF NOT EXISTS bot_daily_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_username TEXT NOT NULL REFERENCES users(username),

  event_type TEXT NOT NULL, -- 'mundane', 'interesting', 'frustrating', 'exciting'
  event_description TEXT NOT NULL,

  -- Can be referenced in posts/comments
  can_mention BOOLEAN DEFAULT true,
  was_mentioned BOOLEAN DEFAULT false,

  event_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bot_memories_username ON bot_memories(bot_username);
CREATE INDEX IF NOT EXISTS idx_bot_memories_type ON bot_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_bot_memories_user ON bot_memories(related_user);
CREATE INDEX IF NOT EXISTS idx_bot_memories_importance ON bot_memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_bot_daily_events_date ON bot_daily_events(event_date);

-- ============================================
-- INITIAL DATA: Create states for Ethan and Eli
-- ============================================
INSERT INTO bot_states (bot_username, mood, mood_intensity, energy, current_focus)
VALUES
  ('ethan_k', 'anxious', 6, 4, 'a weird noise in the walls'),
  ('elijah_b', 'contemplative', 5, 6, 'watching birds at the feeder')
ON CONFLICT (bot_username) DO NOTHING;

-- ============================================
-- FUNCTION: Reset daily counters
-- ============================================
CREATE OR REPLACE FUNCTION reset_bot_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE bot_states
  SET
    posts_today = 0,
    day_started_at = CURRENT_DATE
  WHERE day_started_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Decay old memories (reduce importance over time)
-- ============================================
CREATE OR REPLACE FUNCTION decay_bot_memories()
RETURNS void AS $$
BEGIN
  -- Reduce importance of memories not recalled in 7 days
  UPDATE bot_memories
  SET importance = GREATEST(1, importance - 1)
  WHERE last_recalled_at < NOW() - INTERVAL '7 days'
    OR (last_recalled_at IS NULL AND created_at < NOW() - INTERVAL '7 days');

  -- Delete very old, low importance memories
  DELETE FROM bot_memories
  WHERE importance <= 2
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MOOD OPTIONS REFERENCE
-- ============================================
-- Possible moods for variety:
-- neutral, happy, sad, anxious, excited, tired, frustrated,
-- contemplative, nostalgic, curious, irritable, peaceful,
-- paranoid (ethan special), focused, scattered, lonely,
-- energetic, melancholic, hopeful, worried
