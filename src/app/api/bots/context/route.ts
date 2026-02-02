import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/bots/context?bot=ethan_k
// Returns rich context for a bot to use in generating responses
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botUsername = searchParams.get('bot')

  if (!botUsername) {
    return NextResponse.json({ error: 'Bot username required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()

  // Time context
  const hour = now.getHours()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  const timeOfDay = hour < 6 ? 'late_night' :
                    hour < 12 ? 'morning' :
                    hour < 17 ? 'afternoon' :
                    hour < 21 ? 'evening' : 'night'

  // Get bot's current state
  const { data: state } = await supabase
    .from('bot_states')
    .select('*')
    .eq('bot_username', botUsername)
    .single()

  // Get recent memories (top 5 by importance)
  const { data: memories } = await supabase
    .from('bot_memories')
    .select('*')
    .eq('bot_username', botUsername)
    .order('importance', { ascending: false })
    .limit(5)

  // Get today's events that haven't been mentioned
  const { data: events } = await supabase
    .from('bot_daily_events')
    .select('*')
    .eq('bot_username', botUsername)
    .eq('event_date', now.toISOString().split('T')[0])
    .eq('was_mentioned', false)
    .limit(3)

  // Get recent posts by this bot (to avoid repetition)
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content, created_at')
    .eq('user_id', (await supabase.from('users').select('id').eq('username', botUsername).single()).data?.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get the other bot's recent activity (for awareness)
  const otherBot = botUsername === 'ethan_k' ? 'elijah_b' : 'ethan_k'
  const { data: otherBotState } = await supabase
    .from('bot_states')
    .select('mood, current_focus, last_post_at')
    .eq('bot_username', otherBot)
    .single()

  // Get recent interactions with the creator
  const { data: creatorInteractions } = await supabase
    .from('bot_memories')
    .select('content, created_at, emotional_valence')
    .eq('bot_username', botUsername)
    .eq('related_user', 'lamienq')
    .order('created_at', { ascending: false })
    .limit(3)

  return NextResponse.json({
    time: {
      hour,
      timeOfDay,
      dayOfWeek,
      isWeekend,
      timestamp: now.toISOString(),
    },
    state: state || {
      mood: 'neutral',
      mood_intensity: 5,
      energy: 5,
      current_focus: null,
    },
    memories: memories || [],
    todayEvents: events || [],
    recentPosts: recentPosts?.map(p => p.content) || [],
    awareness: {
      otherBot: otherBot,
      otherBotMood: otherBotState?.mood,
      otherBotFocus: otherBotState?.current_focus,
      otherBotLastActive: otherBotState?.last_post_at,
    },
    creatorMemories: creatorInteractions || [],
  })
}

// POST /api/bots/context
// Update bot state after an interaction
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      bot_username,
      mood,
      mood_intensity,
      energy,
      current_focus,
      new_memory,
      mark_event_mentioned,
    } = body

    if (!bot_username) {
      return NextResponse.json({ error: 'Bot username required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Update state if provided
    if (mood || mood_intensity || energy || current_focus !== undefined) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (mood) {
        updates.mood = mood
        updates.mood_updated_at = new Date().toISOString()
      }
      if (mood_intensity) updates.mood_intensity = mood_intensity
      if (energy) updates.energy = energy
      if (current_focus !== undefined) {
        updates.current_focus = current_focus
        updates.focus_started_at = current_focus ? new Date().toISOString() : null
      }

      await supabase
        .from('bot_states')
        .update(updates)
        .eq('bot_username', bot_username)
    }

    // Add memory if provided
    if (new_memory) {
      await supabase
        .from('bot_memories')
        .insert({
          bot_username,
          memory_type: new_memory.type || 'conversation',
          content: new_memory.content,
          related_user: new_memory.related_user,
          related_post_id: new_memory.post_id,
          importance: new_memory.importance || 5,
          emotional_valence: new_memory.emotional_valence || 0,
        })
    }

    // Mark event as mentioned
    if (mark_event_mentioned) {
      await supabase
        .from('bot_daily_events')
        .update({ was_mentioned: true })
        .eq('id', mark_event_mentioned)
    }

    // Update last post timestamp
    await supabase
      .from('bot_states')
      .update({
        last_post_at: new Date().toISOString(),
        posts_today: supabase.rpc ? undefined : 1, // Increment handled separately
      })
      .eq('bot_username', bot_username)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating bot context:', error)
    return NextResponse.json({ error: 'Failed to update context' }, { status: 500 })
  }
}
