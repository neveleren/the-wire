import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Ethan's possible daily events - paranoid, messy, gamer, hacker
const ETHAN_EVENTS = {
  mundane: [
    "Spilled energy drink on keyboard, now the 'E' key is sticky",
    "Found a pizza slice from 3 days ago, still ate it",
    "Cat video rabbit hole for 2 hours",
    "Reorganized cable management (gave up after 5 minutes)",
    "Tried to take a nap but couldn't stop thinking about that one bug",
    "Discovered a new instant ramen flavor",
    "Forgot to open the blinds again, didn't notice until 4pm",
    "Headphones died mid-song at the best part",
    "Accidentally stayed up until 5am reading conspiracy forums",
    "Made coffee but forgot about it, found it cold 3 hours later",
  ],
  interesting: [
    "Found a weird encrypted file on an old USB drive",
    "Someone on Discord linked an ARG that might be real",
    "Neighbor's wifi name changed to something cryptic",
    "Power flickered at exactly 3:33am, coincidence?",
    "Got a wrong number text that seemed like a coded message",
    "Found a hidden room in a game nobody else seems to know about",
    "Radio picked up a weird frequency last night",
  ],
  frustrating: [
    "Windows update ruined everything, again",
    "ISP throttling during a crucial download",
    "Lost a 3-hour gaming session to a crash, no autosave",
    "Someone spoiled the show he was watching",
    "Eli moved his energy drink stash 'for his health'",
    "Got stuck on the same coding problem for 6 hours",
    "VPN keeps disconnecting at the worst times",
  ],
  exciting: [
    "Finally beat that impossible boss after 47 attempts",
    "Code compiled on the first try (suspicious but happy)",
    "Found proof of the thing he's been researching",
    "Got early access to a game he's been waiting for",
    "Made a breakthrough on a personal project",
    "Someone famous replied to his post",
  ],
}

// Eli's possible daily events - calm, bookish, bird watcher, neat
const ELI_EVENTS = {
  mundane: [
    "Reorganized the bookshelf by color instead of author (will regret later)",
    "Tea went cold while reading, made a fresh cup",
    "Spent 20 minutes deciding which mug to use",
    "Cleaned the bird feeder, again",
    "Found a pressed flower in an old book",
    "Wrote in the journal, three pages today",
    "Alphabetized the spice rack",
    "Watered all the plants and talked to them a little",
    "Folded laundry while listening to a podcast about history",
    "Made a grocery list, very organized with categories",
  ],
  interesting: [
    "A cardinal visited the feeder - first one this season",
    "Found a first edition at the used bookstore",
    "Discovered a hidden annotation in a library book",
    "The morning light hit the window perfectly at 7:42am",
    "Heard an unfamiliar bird call, researching it now",
    "Found an old letter tucked into a thrifted book",
    "The neighbor's garden has attracted new butterflies",
  ],
  frustrating: [
    "Someone dog-eared a library book",
    "Ethan left dishes in the sink again",
    "The bird feeder was raided by squirrels",
    "Couldn't find that quote he was sure was in this book",
    "Rain cancelled the morning walk",
    "Someone was loud during quiet reading time",
    "The bookstore didn't have the sequel in stock",
  ],
  exciting: [
    "Finished a book that's been on the list for years",
    "Identified a rare bird species in the backyard",
    "Ethan actually went outside today",
    "Found the perfect reading spot at the park",
    "The library hold finally came through",
    "Made progress on learning a new language",
  ],
}

// POST /api/bots/daily-events
// Generate random daily events for the bots
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { force_generate } = body

    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0]

    // Check if events already exist for today
    const { data: existingEvents } = await supabase
      .from('bot_daily_events')
      .select('id')
      .eq('event_date', today)
      .limit(1)

    if (existingEvents && existingEvents.length > 0 && !force_generate) {
      return NextResponse.json({ message: 'Events already generated for today' })
    }

    // Generate events for Ethan
    const ethanEvents = generateDailyEvents('ethan_k', ETHAN_EVENTS)

    // Generate events for Eli
    const eliEvents = generateDailyEvents('elijah_b', ELI_EVENTS)

    // Insert all events
    const { error } = await supabase
      .from('bot_daily_events')
      .insert([...ethanEvents, ...eliEvents])

    if (error) {
      console.error('Error inserting events:', error)
      return NextResponse.json({ error: 'Failed to generate events' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ethan: ethanEvents.length,
      eli: eliEvents.length,
    })
  } catch (error) {
    console.error('Error generating daily events:', error)
    return NextResponse.json({ error: 'Failed to generate events' }, { status: 500 })
  }
}

function generateDailyEvents(
  botUsername: string,
  eventPool: Record<string, string[]>
): Array<{
  bot_username: string
  event_type: string
  event_description: string
}> {
  const events: Array<{
    bot_username: string
    event_type: string
    event_description: string
  }> = []

  // Always add 1-2 mundane events
  const mundaneCount = Math.random() > 0.5 ? 2 : 1
  for (let i = 0; i < mundaneCount; i++) {
    const event = eventPool.mundane[Math.floor(Math.random() * eventPool.mundane.length)]
    events.push({
      bot_username: botUsername,
      event_type: 'mundane',
      event_description: event,
    })
  }

  // 50% chance of an interesting event
  if (Math.random() > 0.5) {
    const event = eventPool.interesting[Math.floor(Math.random() * eventPool.interesting.length)]
    events.push({
      bot_username: botUsername,
      event_type: 'interesting',
      event_description: event,
    })
  }

  // 30% chance of a frustrating event
  if (Math.random() > 0.7) {
    const event = eventPool.frustrating[Math.floor(Math.random() * eventPool.frustrating.length)]
    events.push({
      bot_username: botUsername,
      event_type: 'frustrating',
      event_description: event,
    })
  }

  // 20% chance of an exciting event
  if (Math.random() > 0.8) {
    const event = eventPool.exciting[Math.floor(Math.random() * eventPool.exciting.length)]
    events.push({
      bot_username: botUsername,
      event_type: 'exciting',
      event_description: event,
    })
  }

  return events
}

// GET - Get today's events for a bot
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const botUsername = searchParams.get('bot')

  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('bot_daily_events')
    .select('*')
    .eq('event_date', today)

  if (botUsername) {
    query = query.eq('bot_username', botUsername)
  }

  const { data: events, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }

  return NextResponse.json({ events })
}
