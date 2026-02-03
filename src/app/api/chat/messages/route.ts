import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/chat/messages
// Returns chat messages with user data and reply references
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // First, get all messages with user data
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users!chat_messages_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_bot
        )
      `)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Error fetching chat messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Get reply data for messages that have reply_to_id
    const messagesWithReplies = await Promise.all(
      (messages || []).map(async (msg) => {
        if (msg.reply_to_id) {
          const { data: replyMsg } = await supabase
            .from('chat_messages')
            .select(`
              id,
              content,
              user:users!chat_messages_user_id_fkey (display_name)
            `)
            .eq('id', msg.reply_to_id)
            .single()

          if (replyMsg) {
            return {
              ...msg,
              reply_to: replyMsg,
            }
          }
        }
        return msg
      })
    )

    return NextResponse.json({ messages: messagesWithReplies })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/chat/messages
// Create a new chat message and trigger bot responses
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { content, username, media_url, media_type, reply_to_id } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get user by username (default to creator if not specified)
    const userToPost = username || 'lamienq'
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', userToPost)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: `User not found: ${userToPost}` }, { status: 404 })
    }

    // Get reply context if replying to a message
    let replyContext: { username: string; displayName: string; content: string } | null = null
    if (reply_to_id) {
      const { data: replyMsg } = await supabase
        .from('chat_messages')
        .select(`
          content,
          user:users!chat_messages_user_id_fkey (username, display_name)
        `)
        .eq('id', reply_to_id)
        .single()

      if (replyMsg) {
        const replyUser = replyMsg.user as unknown as { username: string; display_name: string }
        replyContext = {
          username: replyUser?.username || 'unknown',
          displayName: replyUser?.display_name || 'Unknown',
          content: replyMsg.content,
        }
      }
    }

    // Create the chat message
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        content,
        media_url: media_url || null,
        media_type: media_type || null,
        reply_to_id: reply_to_id || null,
      })
      .select(`
        *,
        user:users!chat_messages_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_bot
        )
      `)
      .single()

    if (messageError) {
      console.error('Error creating chat message:', messageError)
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
    }

    const botUsernames = ['ethan_k', 'elijah_b']

    // Helper to fetch rich context for a bot
    const fetchBotContext = async (botUsername: string) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-wire-five.vercel.app'
        const response = await fetch(`${baseUrl}/api/bots/context?bot=${botUsername}`)
        if (response.ok) {
          return await response.json()
        }
      } catch (err) {
        console.error(`Failed to fetch context for ${botUsername}:`, err)
      }
      return null
    }

    // Helper to get recent chat history
    const getRecentChatHistory = async (limit = 15) => {
      const { data: history } = await supabase
        .from('chat_messages')
        .select(`
          content,
          created_at,
          user:users!chat_messages_user_id_fkey (username, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!history) return []

      // Reverse to get chronological order and format
      return history.reverse().map(msg => {
        const msgUser = msg.user as unknown as { username: string; display_name: string }
        return {
          from: msgUser?.display_name || msgUser?.username || 'Unknown',
          username: msgUser?.username,
          content: msg.content,
          timestamp: msg.created_at
        }
      })
    }

    // Helper to trigger a bot chat response
    const triggerBotChat = async (
      botUsername: string,
      targetContent: string,
      senderUsername: string,
      messageId: string,
      replyInfo?: { username: string; displayName: string; content: string } | null
    ) => {
      const webhook = botUsername === 'ethan_k'
        ? 'https://neveleren.app.n8n.cloud/webhook/ethan-chat'
        : 'https://neveleren.app.n8n.cloud/webhook/elijah-chat'

      console.log(`[The Wire Chat] Triggering ${botUsername} to respond in chat`)

      try {
        // Fetch rich context for the bot
        const context = await fetchBotContext(botUsername)
        const chatHistory = await getRecentChatHistory(15)

        // Get the other bot's last message for awareness
        const otherBot = botUsername === 'ethan_k' ? 'elijah_b' : 'ethan_k'
        const otherBotLastMsg = chatHistory.filter(m => m.username === otherBot).slice(-1)[0]

        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_content: targetContent,
            sender: senderUsername,
            sender_display_name: senderUsername === 'lamienq' ? 'Rene' :
                                 senderUsername === 'ethan_k' ? 'Ethan' :
                                 senderUsername === 'elijah_b' ? 'Eli' : senderUsername,
            // The message ID the bot should reply to
            reply_to_message_id: messageId,
            chat_history: chatHistory,
            other_bot_said: otherBotLastMsg?.content || null,
            // Reply context - who the sender was replying to
            reply_to: replyInfo ? {
              username: replyInfo.username,
              display_name: replyInfo.displayName,
              content: replyInfo.content,
            } : null,
            context: context ? {
              time: context.time,
              mood: context.state?.mood,
              mood_intensity: context.state?.mood_intensity,
              energy: context.state?.energy,
              current_focus: context.state?.current_focus,
              recent_memories: context.memories?.slice(0, 3).map((m: { content: string }) => m.content),
              todays_events: context.todayEvents?.map((e: { event_description: string }) => e.event_description),
              creator_memories: context.creatorMemories?.map((m: { content: string }) => m.content),
            } : null
          })
        })
        console.log(`[The Wire Chat] Successfully triggered ${botUsername}`)
      } catch (err) {
        console.error(`Failed to trigger ${botUsername} chat:`, err)
      }
    }

    // Helper to save chat memory for a bot
    const saveChatMemory = async (botUsername: string, memoryContent: string, relatedUser?: string) => {
      try {
        await supabase
          .from('bot_memories')
          .insert({
            bot_username: botUsername,
            memory_type: 'chat_conversation',
            content: memoryContent,
            related_user: relatedUser,
            importance: 7, // High importance for direct chat
            emotional_valence: 0,
          })
      } catch (err) {
        console.error(`Failed to save memory for ${botUsername}:`, err)
      }
    }

    // If user (not a bot) sent a message, trigger both bots to respond
    if (!botUsernames.includes(userToPost)) {
      console.log(`[The Wire Chat] User ${userToPost} sent message, triggering both bots`)

      // Fire webhooks immediately (can't use setTimeout on serverless)
      // Both bots will respond - n8n workflows handle their own timing
      triggerBotChat('ethan_k', content, userToPost, message.id, replyContext).catch(err =>
        console.error('Ethan chat trigger failed:', err)
      )
      triggerBotChat('elijah_b', content, userToPost, message.id, replyContext).catch(err =>
        console.error('Eli chat trigger failed:', err)
      )
    }
    // If a bot sent a message, save memory and maybe trigger the other bot
    else if (botUsernames.includes(userToPost)) {
      // Save memory of what this bot said
      const memoryContent = `In chat, I said: "${content.substring(0, 200)}"`
      await saveChatMemory(userToPost, memoryContent)

      // Get the last non-bot message to remember context
      const chatHistory = await getRecentChatHistory(10)
      const lastUserMsg = chatHistory.filter(m => !botUsernames.includes(m.username || '')).slice(-1)[0]
      if (lastUserMsg) {
        const userMemory = `Rene said in chat: "${lastUserMsg.content.substring(0, 200)}"`
        await saveChatMemory(userToPost, userMemory, lastUserMsg.username)
      }

      // 30% chance the other bot continues the conversation
      const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
      if (Math.random() < 0.3) {
        triggerBotChat(otherBot, content, userToPost, message.id, replyContext).catch(err =>
          console.error('Other bot chat trigger failed:', err)
        )
      }
    }

    // Check if we should auto-summarize (every ~20 messages)
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })

    if (totalMessages && totalMessages % 20 === 0) {
      // Trigger summarization in background
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-wire-five.vercel.app'
      fetch(`${baseUrl}/api/bots/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).catch(err => console.error('Auto-summarize failed:', err))
    }

    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
