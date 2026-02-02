import { Header } from '@/components/Header'
import { Post } from '@/components/Post'
import { ComposeButton } from '@/components/ComposeButton'
import { getSupabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getPosts() {
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
      return []
    }

    // Recursive function to count all replies in a thread
    const countAllReplies = async (postIds: string[], depth = 0, maxDepth = 10): Promise<number> => {
      if (depth >= maxDepth || postIds.length === 0) return 0

      const { data: replies } = await supabase
        .from('posts')
        .select('id')
        .in('reply_to_id', postIds)

      if (!replies || replies.length === 0) return 0

      const childIds = replies.map(r => r.id)
      const nestedCount = await countAllReplies(childIds, depth + 1, maxDepth)

      return replies.length + nestedCount
    }

    // Get counts for each post
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const [likesResult, repostsResult, totalReplies] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('posts').select('id', { count: 'exact' }).eq('repost_of_id', post.id),
          countAllReplies([post.id]),
        ])

        return {
          ...post,
          likes_count: likesResult.count || 0,
          replies_count: totalReplies,
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

async function getUsers() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(3)

    if (error) {
      console.error('Error fetching users:', error)
      return []
    }

    return users
  } catch {
    return []
  }
}

export const revalidate = 0 // Don't cache, always fetch fresh

export default async function Home() {
  const [posts, users] = await Promise.all([getPosts(), getUsers()])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
          <p className="text-foreground-muted tracking-wider uppercase mb-6">
            Real thoughts. Real people.
          </p>
          <h1 className="heading-editorial text-6xl md:text-8xl mb-8">
            The Wire
          </h1>
          <p className="font-subtitle text-foreground-secondary text-xl md:text-2xl max-w-2xl mx-auto">
            A place to share what&apos;s on your mind. No filters, no algorithms, just thoughts.
          </p>
        </div>
      </section>

      {/* Feed Section */}
      <section className="py-12 md:py-16 bg-background-alt">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          {/* Section header */}
          <div className="mb-12">
            <h2 className="heading-editorial text-4xl md:text-5xl mb-3">Latest Posts</h2>
            <p className="font-subtitle text-foreground-muted text-lg">
              See what people are thinking
            </p>
          </div>

          {/* Posts grid */}
          <div className="space-y-6">
            {posts.length > 0 ? (
              posts.map((post) => (
                <Post key={post.id} post={post} />
              ))
            ) : (
              <div className="pixel-card p-8 text-center">
                <p className="text-foreground-muted text-lg">No posts yet. Be the first to share something!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured Users Section */}
      <section className="py-16 md:py-20 section-dark">
        <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
          <h2 className="heading-editorial text-4xl md:text-5xl mb-3 text-background">
            People on The Wire
          </h2>
          <p className="font-subtitle text-background/70 text-lg mb-12">
            Interesting voices worth following
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {users.map((user) => (
              <Link key={user.id} href={`/user/${user.username}`} className="pixel-card p-8 text-left hover:translate-x-0 hover:translate-y-0">
                <div className="icon-circle icon-circle-lg mb-5">
                  <span className="text-foreground text-2xl font-semibold">
                    {user.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h3 className="font-subtitle text-xl text-foreground">{user.display_name}</h3>
                <p className="text-foreground-muted mt-1">@{user.username}</p>
                <p className="text-foreground-secondary mt-4">
                  {user.bio || 'No bio yet'}
                </p>
              </Link>
            ))}
          </div>
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

      {/* Compose button */}
      <ComposeButton />
    </div>
  )
}
