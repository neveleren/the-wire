# Group Chat Feature - Implementation Plan

## Overview
Create a group chat feature for The Wire where Rene, Ethan, and Eli can chat together with persistent memory. Bots will remember everything discussed in chat and carry that context into posts.

---

## Phase 1: Database Schema

### New Table: `chat_messages`
```sql
CREATE TABLE chat_messages (
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

-- Index for efficient retrieval
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
```

### Enhanced Memory Storage
When bots respond in chat, we automatically create memories in `bot_memories`:
- `memory_type`: 'chat_conversation'
- Higher `importance` (7-8) for chat messages since they're direct conversations
- Store context about what was discussed for cross-referencing with posts

---

## Phase 2: API Endpoints

### GET `/api/chat/messages`
- Returns last 50 messages with user data
- Includes media/link previews
- Returns in chronological order (oldest first for chat display)

### POST `/api/chat/messages`
- Creates new chat message
- If from user (lamienq): triggers both bots to respond
- If from bot: stores memory and may trigger other bot
- Handles media URLs and generates link previews
- Returns created message

### POST `/api/chat/typing`
- Optional: typing indicators
- Bots can show "typing..." while n8n generates response

---

## Phase 3: n8n Workflows

### New Workflow: "Ethan Chat Response"
**Webhook**: `/webhook/ethan-chat`

**Input**:
```json
{
  "message_id": "uuid",
  "content": "user message",
  "sender": "lamienq",
  "recent_messages": [...last 10 messages for context...],
  "context": {
    "mood": "anxious",
    "energy": 4,
    "memories": [...relevant memories...],
    "eli_last_said": "..."
  }
}
```

**Prompt additions**:
- Include recent chat history for conversational flow
- Instruct to reference past chat discussions naturally
- Can share images/links when relevant

### New Workflow: "Elijah Chat Response"
Same structure as Ethan, different webhook path.

---

## Phase 4: Frontend Components

### 1. `ChatBubble.tsx` - Floating Icon
```
Location: Fixed bottom-right (above compose button)
Style: icon-circle with chat icon
Behavior: Click opens chat overlay
Badge: Unread message count (optional)
```

### 2. `ChatOverlay.tsx` - Chat Interface
```
Structure:
┌─────────────────────────────────┐
│ Group Chat          [X close]   │  ← Header
├─────────────────────────────────┤
│                                 │
│  [Eli avatar] Eli: message...   │
│                                 │
│  [Ethan avatar] Ethan: msg...   │
│                                 │
│  [Your avatar] You: message...  │
│                                 │
│  ... scrollable messages ...    │
│                                 │
├─────────────────────────────────┤
│ [📎] [Type a message...] [Send] │  ← Input area
└─────────────────────────────────┘

Styling:
- pixel-card for container
- Messages with avatar + name + content
- Your messages aligned right, theirs left
- "Typing..." indicator when bots are responding
- Image/link preview support
```

### 3. `ChatMessage.tsx` - Individual Message
- Avatar (icon-circle)
- Username
- Message content
- Media preview if present
- Timestamp on hover
- Reply indicator if replying to specific message

---

## Phase 5: Memory Integration

### How Memories Work Across Chat and Posts

1. **Chat → Memory**: When bots respond in chat, key topics are saved:
   ```
   memory_type: 'chat_conversation'
   content: "Discussed Rene's stressful day at work with bombings"
   importance: 7 (high - direct conversation)
   emotional_valence: -2 (concerning topic)
   ```

2. **Memory → Context**: When user posts later, the `/api/bots/context` endpoint:
   - Retrieves recent chat memories
   - Includes them in bot context
   - Bots naturally reference "we talked about this earlier"

3. **Cross-Reference Logic**:
   - If post content matches recent chat topics → include those memories
   - Use keyword matching or similarity scoring
   - Bots can say things like "Like you mentioned in our chat..."

---

## Phase 6: Media Sharing

### Image Sharing
1. User can paste image URL in chat
2. API validates URL is an image (check extension/content-type)
3. Display as embedded image in chat
4. Bots can also share images by including URLs in responses
5. n8n prompt includes: "You can share relevant images from the internet by including image URLs"

### Link Sharing
1. Detect URLs in message content
2. Fetch basic metadata (title, description, image) for preview
3. Display as link card in chat
4. Bots can share interesting links they "found"

---

## Implementation Order

### Step 1: Database (15 min)
- [ ] Create chat_messages table migration
- [ ] Run migration in Supabase

### Step 2: Basic API (30 min)
- [ ] GET /api/chat/messages - fetch messages
- [ ] POST /api/chat/messages - create message + trigger bots

### Step 3: Chat UI (45 min)
- [ ] ChatBubble.tsx - floating icon
- [ ] ChatOverlay.tsx - main chat interface
- [ ] ChatMessage.tsx - message display
- [ ] Wire into page.tsx

### Step 4: n8n Workflows (30 min)
- [ ] Create Ethan Chat Response workflow
- [ ] Create Elijah Chat Response workflow
- [ ] Test chat conversations

### Step 5: Memory System (30 min)
- [ ] Auto-save chat memories
- [ ] Include chat context in post responses
- [ ] Test memory recall across chat/posts

### Step 6: Media Support (20 min)
- [ ] URL detection and image embedding
- [ ] Link preview generation
- [ ] Bot image/link sharing capability

---

## File Structure

```
src/
├── app/
│   └── api/
│       └── chat/
│           ├── messages/
│           │   └── route.ts      ← Chat messages API
│           └── typing/
│               └── route.ts      ← Typing indicators (optional)
├── components/
│   ├── ChatBubble.tsx            ← Floating chat icon
│   ├── ChatOverlay.tsx           ← Main chat interface
│   └── ChatMessage.tsx           ← Individual message
└── ...

supabase/
└── migrations/
    └── 002_chat_system.sql       ← Chat tables
```

---

## Questions Resolved

**Q: Real-time updates?**
A: Start with polling (every 2-3 seconds when chat is open). Can upgrade to Supabase Realtime later if needed.

**Q: How do bots decide who responds first?**
A: Both get triggered, random delay (2-5 seconds) so responses feel natural. They can respond to each other too.

**Q: Memory limits?**
A: Keep last 20 chat messages in context. Store important topics as memories for long-term recall.

---

Ready to implement! 🎉
