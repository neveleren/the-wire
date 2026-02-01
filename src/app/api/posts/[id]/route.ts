import { getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

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
    const postUsername = (post.user as { username: string })?.username

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
    const postUsername = (post.user as { username: string })?.username

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
