import { getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch a single post with replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get the post with user data
    const { data: post, error: fetchError } = await supabase
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
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Get counts
    const [likesResult, repliesResult, repostsResult] = await Promise.all([
      supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
      supabase.from('posts').select('id', { count: 'exact' }).eq('reply_to_id', post.id),
      supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
    ])

    // Get ALL replies in this thread (including nested replies)
    // First get direct replies to the main post
    const { data: directReplies } = await supabase
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

    // Get IDs of direct replies to fetch their nested replies
    const directReplyIds = (directReplies || []).map(r => r.id)

    // Fetch nested replies (replies to direct replies)
    let nestedReplies: typeof directReplies = []
    if (directReplyIds.length > 0) {
      const { data: nested } = await supabase
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
        .in('reply_to_id', directReplyIds)
        .order('created_at', { ascending: true })
      nestedReplies = nested || []
    }

    // Combine and sort all replies by created_at
    const allReplies = [...(directReplies || []), ...nestedReplies].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Get likes count for each reply
    const repliesWithCounts = await Promise.all(
      allReplies.map(async (reply) => {
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

    const postWithData = {
      ...post,
      likes_count: likesResult.count || 0,
      replies_count: repliesResult.count || 0,
      reposts_count: repostsResult.count || 0,
      replies: repliesWithCounts,
    }

    return NextResponse.json({ post: postWithData })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { username } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get the post to verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('user_id, user:users!posts_user_id_fkey(username)')
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user owns the post (default to lamienq)
    const userToDelete = username || 'lamienq'
    const userArray = post.user as unknown as { username: string }[] | { username: string }
    const postUsername = Array.isArray(userArray) ? userArray[0]?.username : userArray?.username

    if (postUsername !== userToDelete) {
      return NextResponse.json({ error: 'You can only delete your own posts' }, { status: 403 })
    }

    // Delete related likes first
    await supabase.from('likes').delete().eq('post_id', id)

    // Delete replies to this post
    await supabase.from('posts').delete().eq('reply_to_id', id)

    // Delete the post
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting post:', deleteError)
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Edit a post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { content, username } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Content exceeds 500 characters' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get the post to verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('user_id, user:users!posts_user_id_fkey(username)')
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user owns the post
    const userToEdit = username || 'lamienq'
    const userArray2 = post.user as unknown as { username: string }[] | { username: string }
    const postUsername = Array.isArray(userArray2) ? userArray2[0]?.username : userArray2?.username

    if (postUsername !== userToEdit) {
      return NextResponse.json({ error: 'You can only edit your own posts' }, { status: 403 })
    }

    // Update the post
    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating post:', updateError)
      return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: updatedPost })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
