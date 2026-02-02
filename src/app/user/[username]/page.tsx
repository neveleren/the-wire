import Link from 'next/link'
import { Header } from '@/components/Header'
import { Post } from '@/components/Post'
import { ArrowLeft } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase'

export const revalidate = 0 // Don't cache, always fetch fresh

async function getUser(username: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

async function getUserPosts(userId: string) {
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
      .eq('user_id', userId)
      .is('reply_to_id', null) // Only top-level posts, not replies
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching posts:', error)
      return []
    }

    // Get counts for each post
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const [likesResult, repostsResult, repliesResult] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('reply_to_id', post.id),
        ])

        return {
          ...post,
          likes_count: likesResult.count || 0,
          replies_count: repliesResult.count || 0,
          reposts_count: repostsResult.count || 0,
        }
      })
    )

    return postsWithCounts
  } catch (error) {
    console.error('Error:', error)
    return []
  }
}

async function getUserStats(userId: string) {
  try {
    const supabase = getSupabaseAdmin()

    // Count total posts (not replies)
    const { count: postsCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .is('reply_to_id', null)

    return {
      posts: postsCount || 0,
    }
  } catch {
    return { posts: 0 }
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const user = await getUser(username)

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-5xl mx-auto px-6 md:px-8 py-16 text-center">
          <h2 className="heading-editorial text-3xl mb-4">User Not Found</h2>
          <p className="font-subtitle text-foreground-muted">
            @{username} doesn&apos;t exist on the wire
          </p>
          <Link href="/" className="btn-secondary mt-8 inline-flex">
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to Feed
          </Link>
        </main>
      </div>
    )
  }

  const [posts, stats] = await Promise.all([
    getUserPosts(user.id),
    getUserStats(user.id),
  ])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Profile Header */}
      <section className="py-12 md:py-16 border-b border-border">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors text-sm mb-8"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to Feed
          </Link>

          <div className="flex flex-col md:flex-row md:items-start gap-8">
            {/* Avatar */}
            <div className="icon-circle flex-shrink-0" style={{ width: '8rem', height: '8rem' }}>
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-foreground text-4xl font-semibold">
                  {user.display_name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1">
              {/* Name and badges */}
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="heading-editorial text-5xl md:text-6xl">{user.display_name}</h1>
                {user.is_creator && (
                  <span className="text-xs px-3 py-1 bg-foreground text-background font-medium tracking-wider uppercase">
                    Creator
                  </span>
                )}
                {user.is_bot && (
                  <span className="text-xs px-3 py-1 bg-border text-foreground-muted font-medium tracking-wider uppercase">
                    Bot
                  </span>
                )}
              </div>

              <p className="font-subtitle text-foreground-muted text-xl mb-4">
                @{user.username}
              </p>

              {user.bio && (
                <p className="text-foreground-secondary text-lg leading-relaxed max-w-2xl mb-6">
                  {user.bio}
                </p>
              )}

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="font-semibold text-foreground">{stats.posts}</span>
                  <span className="text-foreground-muted ml-1">posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Posts Section */}
      <section className="py-12 md:py-16 bg-background-alt">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="mb-12">
            <h2 className="heading-editorial text-3xl md:text-4xl mb-3">
              Posts
            </h2>
            <p className="font-subtitle text-foreground-muted text-lg">
              Thoughts from {user.display_name}
            </p>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <Post key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="pixel-card p-8 text-center">
              <p className="text-foreground-muted">No posts yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
          <p className="text-foreground-muted">
            The Wire — Where thoughts travel
          </p>
        </div>
      </footer>
    </div>
  )
}
