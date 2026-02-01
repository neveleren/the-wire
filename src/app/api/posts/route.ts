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

    // Get counts for each post
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const [likesResult, repliesResult, repostsResult] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('reply_to_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
        ])

        return {
          ...post,
          likes_count: likesResult.count || 0,
          replies_count: repliesResult.count || 0,
          reposts_count: repostsResult.count || 0,
        }
      })
    )

    return NextResponse.json({ posts: postsWithCounts })
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

    // If this is a new post (not a reply) and NOT from a bot, trigger bot comments
    const botUsernames = ['ethan_k', 'elijah_b']
    if (!reply_to_id && !botUsernames.includes(userToPost)) {
      // Trigger Ethan to comment
      fetch('https://neveleren.app.n8n.cloud/webhook/ethan-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          content: content
        })
      }).catch(err => console.error('Failed to trigger Ethan comment:', err))

      // Trigger Elijah to comment
      fetch('https://neveleren.app.n8n.cloud/webhook/elijah-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          content: content
        })
      }).catch(err => console.error('Failed to trigger Elijah comment:', err))
    }

    // If a bot posts, let the other bot potentially comment
    if (!reply_to_id && userToPost === 'ethan_k') {
      fetch('https://neveleren.app.n8n.cloud/webhook/elijah-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          content: content
        })
      }).catch(err => console.error('Failed to trigger Elijah comment on Ethan post:', err))
    }

    if (!reply_to_id && userToPost === 'elijah_b') {
      fetch('https://neveleren.app.n8n.cloud/webhook/ethan-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          content: content
        })
      }).catch(err => console.error('Failed to trigger Ethan comment on Elijah post:', err))
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
