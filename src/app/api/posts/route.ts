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

    // Get counts and replies for each post
    const postsWithCountsAndReplies = await Promise.all(
      posts.map(async (post) => {
        const [likesResult, repliesResult, repostsResult, repliesData] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('reply_to_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
          // Fetch actual replies with user data
          supabase
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
            .eq('reply_to_id', post.id)
            .order('created_at', { ascending: true })
            .limit(10),
        ])

        // Get likes count for each reply
        const repliesWithCounts = await Promise.all(
          (repliesData.data || []).map(async (reply) => {
            const { count } = await supabase
              .from('likes')
              .select('id', { count: 'exact' })
              .eq('post_id', reply.id)
            return {
              ...reply,
              likes_count: count || 0,
              replies_count: 0,
              reposts_count: 0,
            }
          })
        )

        return {
          ...post,
          likes_count: likesResult.count || 0,
          replies_count: repliesResult.count || 0,
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
    const MAX_REPLY_DEPTH = 3 // Limit bot-to-bot replies to prevent loops

    // Helper to trigger a bot reply
    const triggerBot = (botUsername: string, targetPostId: string, targetContent: string, newDepth: number) => {
      const webhook = botUsername === 'ethan_k'
        ? 'https://neveleren.app.n8n.cloud/webhook/ethan-comment'
        : 'https://neveleren.app.n8n.cloud/webhook/elijah-comment'

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

    // NEW POST (not a reply)
    if (!reply_to_id) {
      if (!botUsernames.includes(userToPost)) {
        // User posted - both bots comment
        triggerBot('ethan_k', post.id, content, 0)
        triggerBot('elijah_b', post.id, content, 0)
      } else if (userToPost === 'ethan_k') {
        // Ethan posted - Elijah comments
        triggerBot('elijah_b', post.id, content, 0)
      } else if (userToPost === 'elijah_b') {
        // Elijah posted - Ethan comments
        triggerBot('ethan_k', post.id, content, 0)
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

        // User replied to a bot - that bot replies back
        if (!botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername)) {
          triggerBot(parentUsername, post.id, content, depth + 1)
        }
        // Bot replied to another bot - the other bot replies (with depth limit)
        else if (botUsernames.includes(userToPost) && parentUsername && botUsernames.includes(parentUsername) && depth < MAX_REPLY_DEPTH) {
          // Only reply ~50% of the time to make it more natural
          if (Math.random() > 0.5) {
            const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
            // Small delay to make conversation feel natural
            setTimeout(() => {
              triggerBot(otherBot, post.id, content, depth + 1)
            }, 2000)
          }
        }
        // Bot replied to user - user might get a follow-up from the other bot sometimes
        else if (botUsernames.includes(userToPost) && parentUsername && !botUsernames.includes(parentUsername) && depth < 1) {
          // 30% chance the other bot chimes in
          if (Math.random() > 0.7) {
            const otherBot = userToPost === 'ethan_k' ? 'elijah_b' : 'ethan_k'
            triggerBot(otherBot, post.id, content, depth + 1)
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
