import { getSupabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// POST - Like or unlike a post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_id, username } = body

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get user (default to creator)
    const userToLike = username || 'lamienq'
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', userToLike)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: `User not found: ${userToLike}` }, { status: 404 })
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', post_id)
      .single()

    if (existingLike) {
      // Unlike - remove the like
      await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id)

      return NextResponse.json({ success: true, liked: false })
    } else {
      // Like - add new like
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          user_id: user.id,
          post_id,
        })

      if (likeError) {
        console.error('Error liking post:', likeError)
        return NextResponse.json({ error: 'Failed to like post' }, { status: 500 })
      }

      return NextResponse.json({ success: true, liked: true })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
