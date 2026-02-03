import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// POST /api/bots/summarize
// Summarizes recent chat conversations and saves as memories
// Called automatically after every ~20 messages or manually
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { force } = body // force=true to summarize even if not enough messages

    const supabase = getSupabaseAdmin()

    // Get the last summarization timestamp
    const { data: lastSummary } = await supabase
      .from('bot_memories')
      .select('created_at')
      .eq('memory_type', 'chat_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastSummaryTime = lastSummary?.created_at
      ? new Date(lastSummary.created_at)
      : new Date(0)

    // Get chat messages since last summary
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select(`
        content,
        created_at,
        user:users!chat_messages_user_id_fkey (username, display_name)
      `)
      .gt('created_at', lastSummaryTime.toISOString())
      .order('created_at', { ascending: true })

    if (!recentMessages || recentMessages.length < 15) {
      if (!force) {
        return NextResponse.json({
          skipped: true,
          reason: `Only ${recentMessages?.length || 0} messages since last summary (need 15+)`
        })
      }
    }

    if (!recentMessages || recentMessages.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'No messages to summarize' })
    }

    // Format messages for summarization
    const formattedMessages = recentMessages.map(msg => {
      const msgUser = msg.user as unknown as { username: string; display_name: string }
      return `${msgUser?.display_name || msgUser?.username}: ${msg.content}`
    }).join('\n')

    // Call n8n webhook to generate summary using AI
    const summaryResponse = await fetch('https://neveleren.app.n8n.cloud/webhook/summarize-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: formattedMessages,
        message_count: recentMessages.length,
      })
    })

    if (!summaryResponse.ok) {
      // If webhook doesn't exist yet, create a simple summary ourselves
      const summary = createSimpleSummary(recentMessages)
      await saveSummaryMemories(supabase, summary)
      return NextResponse.json({
        success: true,
        method: 'simple',
        summary
      })
    }

    const summaryData = await summaryResponse.json()
    await saveSummaryMemories(supabase, summaryData.summary)

    return NextResponse.json({
      success: true,
      method: 'ai',
      messagesProcessed: recentMessages.length
    })

  } catch (error) {
    console.error('Error summarizing chat:', error)
    return NextResponse.json({ error: 'Failed to summarize' }, { status: 500 })
  }
}

// Simple summary when AI isn't available
function createSimpleSummary(messages: Array<{ content: string; user: unknown }>) {
  const participants = new Set<string>()
  const topics: string[] = []

  messages.forEach(msg => {
    const msgUser = msg.user as { username: string; display_name: string }
    participants.add(msgUser?.display_name || msgUser?.username || 'Unknown')

    // Extract potential topics (simple keyword detection)
    const content = msg.content.toLowerCase()
    if (content.includes('bomb') || content.includes('explosion') || content.includes('war')) {
      if (!topics.includes('safety concerns')) topics.push('safety concerns')
    }
    if (content.includes('tired') || content.includes('exhausted') || content.includes('sleep')) {
      if (!topics.includes('tiredness')) topics.push('tiredness')
    }
    if (content.includes('happy') || content.includes('excited') || content.includes('good')) {
      if (!topics.includes('positive mood')) topics.push('positive mood')
    }
    if (content.includes('sad') || content.includes('upset') || content.includes('stressed')) {
      if (!topics.includes('difficult emotions')) topics.push('difficult emotions')
    }
    if (content.includes('game') || content.includes('play')) {
      if (!topics.includes('gaming')) topics.push('gaming')
    }
    if (content.includes('food') || content.includes('eat') || content.includes('cook')) {
      if (!topics.includes('food')) topics.push('food')
    }
    if (content.includes('work') || content.includes('job')) {
      if (!topics.includes('work')) topics.push('work')
    }
  })

  const topicStr = topics.length > 0 ? topics.join(', ') : 'casual conversation'
  return `Chat with ${Array.from(participants).join(', ')} about ${topicStr}. ${messages.length} messages exchanged.`
}

// Save summary as memories for both bots
async function saveSummaryMemories(supabase: ReturnType<typeof getSupabaseAdmin>, summary: string) {
  const bots = ['ethan_k', 'elijah_b']

  for (const bot of bots) {
    await supabase
      .from('bot_memories')
      .insert({
        bot_username: bot,
        memory_type: 'chat_summary',
        content: summary,
        importance: 8, // High importance for summaries
        emotional_valence: 0,
      })
  }
}

// GET - Check summarization status
export async function GET() {
  const supabase = getSupabaseAdmin()

  // Get last summary
  const { data: lastSummary } = await supabase
    .from('bot_memories')
    .select('content, created_at')
    .eq('memory_type', 'chat_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Count messages since last summary
  const lastTime = lastSummary?.created_at || '1970-01-01'
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact' })
    .gt('created_at', lastTime)

  return NextResponse.json({
    lastSummary: lastSummary?.content || 'No summaries yet',
    lastSummaryAt: lastSummary?.created_at || null,
    messagesSinceLastSummary: count || 0,
    needsSummary: (count || 0) >= 15,
  })
}
