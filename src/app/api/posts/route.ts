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

    // Helper to trigger a bot reply
    const triggerBot = (botUsername: string, targetPostId: string, targetContent: string, newDepth: number) => {
      const webhook = botUsername === 'ethan_k'
        ? 'https://neveleren.app.n8n.cloud/webhook/ethan-comment'
        : 'https://neveleren.app.n8n.cloud/webhook/elijah-comment'

      console.log(`[The Wire] Triggering ${botUsername} to reply to post ${targetPostId} at depth ${newDepth}`)

      fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: targetPostId,
          content: targetContent,
          depth: newDepth
        })
      }).catch(err => console.error(`Failed to trigger ${botUsername}:`, err))
    }

    // Helper to trigger a bot like
    const triggerBotLike = (botUsername: string, targetPostId: string) => {
      console.log(`[The Wire] Bot ${botUsername} liking post ${targetPostId}`)

      fetch('https://the-wire-five.vercel.app/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: targetPostId,
          username: botUsername
        })
      }).catch(err => console.error(`Failed to trigger like from ${botUsername}:`, err))
    }

    // NEW POST (not a reply)
    if (!reply_to_id) {
      if (!botUsernames.includes(userToPost)) {
        // User posted - both bots comment AND like
        console.log(`[The Wire] User ${userToPost} created post, triggering both bots`)
        triggerBot('ethan_k', post.id, content, 0)
        triggerBot('elijah_b', post.id, content, 0)
        // Bots like user posts
        setTimeout(() => triggerBotLike('ethan_k', post.id), 1000)
        setTimeout(() => triggerBotLike('elijah_b', post.id), 2000)
      } else if (userToPost === 'ethan_k') {
        // Ethan posted - Elijah comments and likes
        triggerBot('elijah_b', post.id, content, 0)
        setTimeout(() => triggerBotLike('elijah_b', post.id), 1500)
      } else if (userToPost === 'elijah_b') {
        // Elijah posted - Ethan comments and likes
        triggerBot('ethan_k', post.id, content, 0)
        setTimeout(() => triggerBotLike('ethan_k', post.id), 1500)
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
          triggerBot(parentUsername, post.id, content, 0) // Reset depth to 0 for user conversations
        }
        // Other user replied to a bot - bot replies back
        else if (!botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername)) {
          triggerBot(parentUsername, post.id, content, depth + 1)
        }
        // Bot replied to another bot - the other bot ALWAYS replies (up to 5 exchanges)
        else if (botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername) && depth < MAX_BOT_TO_BOT_DEPTH) {
          const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
          console.log(`[The Wire] Bot ${userToPost} replied, triggering ${otherBot} at depth ${depth + 1}`)
          // Small delay to make conversation feel natural
          setTimeout(() => {
            triggerBot(otherBot, post.id, content, depth + 1)
          }, 3000)
        }
        // Bot replied to creator (you) - 30% chance the OTHER bot chimes in too
        else if (botUsernames.includes(userToPost) && parentUsername === creatorUsername) {
          if (Math.random() > 0.7) {
            const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
            setTimeout(() => triggerBot(otherBot, post.id, content, 0), 5000)
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
