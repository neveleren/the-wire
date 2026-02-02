import { getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch all posts with user data
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users!posts_user_id_fkey (
          id,
          username,
          display_name,
          bio,
          avatar_url,
          is_bot,
          is_creator
        )
      `)
      .is('reply_to_id', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching posts:', error)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    const selectQuery = `
      *,
      user:users!posts_user_id_fkey (
        id,
        username,
        display_name,
        bio,
        avatar_url,
        is_bot,
        is_creator
      )
    `

    // Recursive function to fetch all replies in a thread
    const fetchRepliesRecursively = async (parentIds: string[], depth = 0, maxDepth = 5): Promise<any[]> => {
      if (depth >= maxDepth || parentIds.length === 0) return []

      const { data: replies } = await supabase
        .from('posts')
        .select(selectQuery)
        .in('reply_to_id', parentIds)
        .order('created_at', { ascending: true })

      if (!replies || replies.length === 0) return []

      const childIds = replies.map(r => r.id)
      const childReplies = await fetchRepliesRecursively(childIds, depth + 1, maxDepth)

      return [...replies, ...(childReplies || [])]
    }

    // Get counts and replies for each post (including nested replies)
    const postsWithCountsAndReplies = await Promise.all(
      posts.map(async (post) => {
        // Get direct replies first
        const { data: directReplies } = await supabase
          .from('posts')
          .select(selectQuery)
          .eq('reply_to_id', post.id)
          .order('created_at', { ascending: true })

        // Get all nested replies recursively
        const directReplyIds = (directReplies || []).map(r => r.id)
        const nestedReplies = await fetchRepliesRecursively(directReplyIds, 0, 5)

        // Combine all replies and sort by created_at
        const allReplies = [...(directReplies || []), ...(nestedReplies || [])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        const [likesResult, repostsResult] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
        ])

        // Build a map of post IDs to user info for "replying to" display
        const postUserMap: Record<string, { username: string; display_name: string }> = {
          [post.id]: { username: post.user.username, display_name: post.user.display_name }
        }
        allReplies.forEach(reply => {
          postUserMap[reply.id] = { username: reply.user.username, display_name: reply.user.display_name }
        })

        // Get likes count for each reply and add "replying to" info
        const repliesWithCounts = await Promise.all(
          allReplies.map(async (reply) => {
            const { count } = await supabase
              .from('likes')
              .select('id', { count: 'exact' })
              .eq('post_id', reply.id)

            const replyingToUser = reply.reply_to_id ? postUserMap[reply.reply_to_id] : null

            return {
              ...reply,
              likes_count: count || 0,
              replies_count: 0,
              reposts_count: 0,
              replying_to: replyingToUser,
            }
          })
        )

        return {
          ...post,
          likes_count: likesResult.count || 0,
          replies_count: allReplies.length,
          reposts_count: repostsResult.count || 0,
          replies: repliesWithCounts,
        }
      })
    )

    return NextResponse.json({ posts: postsWithCountsAndReplies })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new post (for logged-in user or n8n bots)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, username, reply_to_id } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Content exceeds 500 characters' }, { status: 400 })
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

    // Create the post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content,
        reply_to_id: reply_to_id || null,
      })
      .select()
      .single()

    if (postError) {
      console.error('Error creating post:', postError)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    const botUsernames = ['ethan_k', 'elijah_b']
    const depth = body.depth || 0
    const MAX_BOT_TO_BOT_DEPTH = 5 // Limit bot-to-bot replies to 5 exchanges
    const creatorUsername = 'lamienq' // Your username - bots always reply to you without limit

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

    // Helper to trigger a bot reply with rich context
    const triggerBot = async (botUsername: string, targetPostId: string, targetContent: string, newDepth: number, replyingTo?: string) => {
      const webhook = botUsername === 'ethan_k'
        ? 'https://neveleren.app.n8n.cloud/webhook/ethan-comment'
        : 'https://neveleren.app.n8n.cloud/webhook/elijah-comment'

      console.log(`[The Wire] Triggering ${botUsername} to reply to post ${targetPostId} at depth ${newDepth}`)

      try {
        // Fetch rich context for the bot
        const context = await fetchBotContext(botUsername)

        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: targetPostId,
            content: targetContent,
            depth: newDepth,
            replying_to_user: replyingTo || null,
            // Rich context for variety
            context: context ? {
              time: context.time,
              mood: context.state?.mood,
              mood_intensity: context.state?.mood_intensity,
              energy: context.state?.energy,
              current_focus: context.state?.current_focus,
              recent_memories: context.memories?.slice(0, 3).map((m: { content: string }) => m.content),
              todays_events: context.todayEvents?.map((e: { event_description: string }) => e.event_description),
              recent_posts: context.recentPosts?.slice(0, 5),
              other_bot: {
                mood: context.awareness?.otherBotMood,
                focus: context.awareness?.otherBotFocus,
              },
              creator_memories: context.creatorMemories?.map((m: { content: string }) => m.content),
            } : null
          })
        })
        console.log(`[The Wire] Successfully triggered ${botUsername} with context`)
      } catch (err) {
        console.error(`Failed to trigger ${botUsername}:`, err)
      }
    }

    // Helper to trigger a bot like (returns promise)
    const triggerBotLike = async (botUsername: string, targetPostId: string) => {
      console.log(`[The Wire] Bot ${botUsername} liking post ${targetPostId}`)

      try {
        await fetch('https://the-wire-five.vercel.app/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_id: targetPostId,
            username: botUsername
          })
        })
      } catch (err) {
        console.error(`Failed to trigger like from ${botUsername}:`, err)
      }
    }

    // NEW POST (not a reply)
    if (!reply_to_id) {
      if (!botUsernames.includes(userToPost)) {
        // User posted - both bots comment AND like
        console.log(`[The Wire] User ${userToPost} created post, triggering both bots`)
        await Promise.all([
          triggerBot('ethan_k', post.id, content, 0, userToPost),
          triggerBot('elijah_b', post.id, content, 0, userToPost),
          triggerBotLike('ethan_k', post.id),
          triggerBotLike('elijah_b', post.id)
        ])
      } else if (userToPost === 'ethan_k') {
        // Ethan posted - Elijah comments and likes
        await Promise.all([
          triggerBot('elijah_b', post.id, content, 0, 'ethan_k'),
          triggerBotLike('elijah_b', post.id)
        ])
      } else if (userToPost === 'elijah_b') {
        // Elijah posted - Ethan comments and likes
        await Promise.all([
          triggerBot('ethan_k', post.id, content, 0, 'elijah_b'),
          triggerBotLike('ethan_k', post.id)
        ])
      }
    }
    // REPLY to someone's comment
    else if (reply_to_id) {
      // Get the parent comment to see who wrote it
      const { data: parentPost } = await supabase
        .from('posts')
        .select('user_id, content, user:users!posts_user_id_fkey(username)')
        .eq('id', reply_to_id)
        .single()

      if (parentPost) {
        const parentUser = parentPost.user as unknown as { username: string }[] | { username: string }
        const parentUsername = Array.isArray(parentUser) ? parentUser[0]?.username : parentUser?.username

        // Creator (you) replied to a bot - that bot ALWAYS replies back (no depth limit for you!)
        if (userToPost === creatorUsername && parentUsername && botUsernames.includes(parentUsername)) {
          console.log(`[The Wire] Creator replied to ${parentUsername}, bot will reply back (no limit)`)
          await triggerBot(parentUsername, post.id, content, 0, creatorUsername) // Reset depth to 0 for user conversations
        }
        // Other user replied to a bot - bot replies back
        else if (!botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername)) {
          await triggerBot(parentUsername, post.id, content, depth + 1, userToPost)
        }
        // Bot replied to another bot's COMMENT - continue their dialogue (up to 5 exchanges)
        else if (botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername) && depth < MAX_BOT_TO_BOT_DEPTH) {
          const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
          console.log(`[The Wire] Bot ${userToPost} replied to ${parentUsername}, triggering ${otherBot} at depth ${depth + 1}`)
          // Small delay before bot-to-bot reply, but still await it
          await new Promise(resolve => setTimeout(resolve, 3000))
          await triggerBot(otherBot, post.id, content, depth + 1, userToPost)
        }
        // Bot commented on creator's POST - check if the other bot also commented, then start dialogue
        else if (botUsernames.includes(userToPost) && parentUsername === creatorUsername) {
          const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'

          // Check if the other bot has already commented on this same post
          const { data: otherBotUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', otherBot)
            .single()

          if (otherBotUser) {
            const { data: otherBotComment } = await supabase
              .from('posts')
              .select('id, content, created_at')
              .eq('reply_to_id', reply_to_id) // Same parent (the user's original post)
              .eq('user_id', otherBotUser.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (otherBotComment) {
              // Both bots have now commented on the user's post!
              // BUT only the SECOND bot to comment should trigger the dialogue
              // This prevents both bots from triggering simultaneously
              const thisCommentTime = new Date(post.created_at).getTime()
              const otherCommentTime = new Date(otherBotComment.created_at).getTime()

              if (thisCommentTime > otherCommentTime) {
                // This bot commented AFTER the other - this is the second commenter, start dialogue
                console.log(`[The Wire] ${userToPost} is the second bot to comment, starting dialogue with ${otherBot}`)
                await new Promise(resolve => setTimeout(resolve, 4000))
                await triggerBot(otherBot, post.id, content, 1, userToPost)
              } else {
                console.log(`[The Wire] ${userToPost} was first to comment, waiting for ${otherBot} to trigger dialogue`)
              }
            } else {
              console.log(`[The Wire] ${userToPost} commented on user's post, waiting for ${otherBot} to also comment first`)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
