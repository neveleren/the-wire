import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Possible moods for each bot
const ETHAN_MOODS = [
  'anxious', 'curious', 'tired', 'focused', 'scattered',
  'frustrated', 'content', 'paranoid', 'excited', 'melancholic',
  'irritable', 'playful', 'worried', 'neutral'
]

const ELI_MOODS = [
  'contemplative', 'peaceful', 'worried', 'content', 'curious',
  'melancholic', 'hopeful', 'tired', 'focused', 'nostalgic',
  'frustrated', 'gentle', 'neutral', 'lonely'
]

// Possible focuses for each bot
const ETHAN_FOCUSES = [
  'a weird noise in the walls',
  'debugging a tricky problem',
  'that new game everyone\'s talking about',
  'why the internet is slow today',
  'a conspiracy theory rabbit hole',
  'whether to actually go outside',
  'what to eat for dinner',
  'an old project he forgot about',
  'organizing his desktop (again)',
  'why Eli moved his stuff',
  'learning a new programming language',
  'that song stuck in his head',
  null, // no specific focus
  null,
  null,
]

const ELI_FOCUSES = [
  'a book he just started',
  'the birds at the feeder',
  'meal planning for the week',
  'whether Ethan is okay',
  'that interesting podcast episode',
  'reorganizing the bookshelf',
  'the garden',
  'learning new vocabulary',
  'a passage he keeps thinking about',
  'the weather forecast',
  'finding the perfect reading spot',
  'that recipe he wants to try',
  null, // no specific focus
  null,
  null,
]

// POST /api/bots/daily-routine
// Called once per day (or on demand) to:
// 1. Generate daily events
// 2. Shift moods naturally
// 3. Reset daily counters
// 4. Decay old memories
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { secret } = body

    // Simple security - check for secret key
    const expectedSecret = process.env.BOT_ROUTINE_SECRET || 'wire-daily-routine'
    if (secret !== expectedSecret) {
      // Still allow without secret in development
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = getSupabaseAdmin()
    const results: Record<string, unknown> = {}

    // 1. SHIFT MOODS
    // Ethan's mood (more volatile)
    const ethanMood = ETHAN_MOODS[Math.floor(Math.random() * ETHAN_MOODS.length)]
    const ethanFocus = ETHAN_FOCUSES[Math.floor(Math.random() * ETHAN_FOCUSES.length)]
    const ethanEnergy = Math.floor(Math.random() * 4) + 3 // 3-6 range (tends lower)
    const ethanIntensity = Math.floor(Math.random() * 5) + 4 // 4-8 range

    await supabase
      .from('bot_states')
      .upsert({
        bot_username: 'ethan_k',
        mood: ethanMood,
        mood_intensity: ethanIntensity,
        mood_updated_at: new Date().toISOString(),
        energy: ethanEnergy,
        current_focus: ethanFocus,
        focus_started_at: ethanFocus ? new Date().toISOString() : null,
        posts_today: 0,
        day_started_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bot_username' })

    results.ethan = { mood: ethanMood, energy: ethanEnergy, focus: ethanFocus }

    // Eli's mood (more stable)
    const eliMood = ELI_MOODS[Math.floor(Math.random() * ELI_MOODS.length)]
    const eliFocus = ELI_FOCUSES[Math.floor(Math.random() * ELI_FOCUSES.length)]
    const eliEnergy = Math.floor(Math.random() * 4) + 4 // 4-7 range (tends higher)
    const eliIntensity = Math.floor(Math.random() * 4) + 3 // 3-6 range (less intense)

    await supabase
      .from('bot_states')
      .upsert({
        bot_username: 'elijah_b',
        mood: eliMood,
        mood_intensity: eliIntensity,
        mood_updated_at: new Date().toISOString(),
        energy: eliEnergy,
        current_focus: eliFocus,
        focus_started_at: eliFocus ? new Date().toISOString() : null,
        posts_today: 0,
        day_started_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bot_username' })

    results.eli = { mood: eliMood, energy: eliEnergy, focus: eliFocus }

    // 2. GENERATE DAILY EVENTS
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://the-wire-five.vercel.app'
    const eventsResponse = await fetch(`${baseUrl}/api/bots/daily-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_generate: false })
    })
    const eventsResult = await eventsResponse.json()
    results.events = eventsResult

    // 3. DECAY OLD MEMORIES
    // Reduce importance of memories not recalled in 7 days
    await supabase
      .from('bot_memories')
      .update({ importance: 1 }) // Set to minimum instead of decrementing (simpler)
      .lt('last_recalled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    // Also decay memories that were never recalled
    await supabase
      .from('bot_memories')
      .update({ importance: 1 })
      .is('last_recalled_at', null)
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    // Delete very old, low importance memories
    const { count: deletedCount } = await supabase
      .from('bot_memories')
      .delete()
      .lte('importance', 2)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    results.decayed_memories = deletedCount || 0

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    })
  } catch (error) {
    console.error('Error running daily routine:', error)
    return NextResponse.json({ error: 'Failed to run daily routine' }, { status: 500 })
  }
}

// GET - Check current bot states
export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: states } = await supabase
    .from('bot_states')
    .select('*')

  const { data: recentMemories } = await supabase
    .from('bot_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const today = new Date().toISOString().split('T')[0]
  const { data: todayEvents } = await supabase
    .from('bot_daily_events')
    .select('*')
    .eq('event_date', today)

  return NextResponse.json({
    states,
    recentMemories,
    todayEvents,
  })
}
