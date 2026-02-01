'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, MessageCircle, Repeat2, Heart, Share, X } from 'lucide-react'
import type { PostWithUser } from '@/lib/database.types'

interface PostWithReplies extends PostWithUser {
  replies?: PostWithUser[]
}

export default function PostPage() {
  const params = useParams()
  const router = useRouter()
  const [post, setPost] = useState<PostWithReplies | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null)
  const [commentReplyContent, setCommentReplyContent] = useState('')
  const [likesCount, setLikesCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const currentUsername = 'lamienq'

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await fetch(`/api/posts/${params.id}`)
        if (!response.ok) {
          throw new Error('Post not found')
        }
        const data = await response.json()
        setPost(data.post)
        setLikesCount(data.post.likes_count || 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchPost()
    }
  }, [params.id])

  const handleLike = async () => {
    if (isLiking || !post) return
    setIsLiking(true)

    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsLiked(data.liked)
        setLikesCount(prev => data.liked ? prev + 1 : prev - 1)
      }
    } catch (error) {
      console.error('Failed to like:', error)
    } finally {
      setIsLiking(false)
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmittingReply || !post) return
    setIsSubmittingReply(true)

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          username: currentUsername,
          reply_to_id: post.id
        }),
      })

      if (response.ok) {
        setReplyContent('')
        setIsReplying(false)
        // Refresh the post to show new reply
        const refreshResponse = await fetch(`/api/posts/${params.id}`)
        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setPost(data.post)
        }
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Failed to reply:', error)
      alert('Failed to post reply')
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const handleCommentReply = async (commentId: string) => {
    if (!commentReplyContent.trim() || isSubmittingReply) return
    setIsSubmittingReply(true)

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentReplyContent,
          username: currentUsername,
          reply_to_id: commentId
        }),
      })

      if (response.ok) {
        setCommentReplyContent('')
        setReplyingToComment(null)
        // Refresh the post to show new reply
        const refreshResponse = await fetch(`/api/posts/${params.id}`)
        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          setPost(data.post)
        }
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Failed to reply:', error)
      alert('Failed to post reply')
    } finally {
      setIsSubmittingReply(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground-muted">Loading...</div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-foreground-muted">{error || 'Post not found'}</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border-2 border-foreground hover:bg-border transition-colors"
        >
          Go back
        </button>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false })

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-border rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-headline text-2xl">Post</h1>
        </div>

        {/* Main Post */}
        <article className="pixel-card p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Link href={`/user/${post.user.username}`}>
              <div className="icon-circle icon-circle-lg flex-shrink-0">
                {post.user.avatar_url ? (
                  <img
                    src={post.user.avatar_url}
                    alt={post.user.display_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-foreground text-xl font-semibold">
                    {post.user.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/user/${post.user.username}`}
                  className="font-subtitle text-xl hover:underline"
                >
                  {post.user.display_name}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-foreground-muted text-sm mt-0.5">
                <span>@{post.user.username}</span>
                <span>·</span>
                <time>{timeAgo}</time>
              </div>
            </div>
          </div>

          {/* Post content */}
          <div className="mt-5 pl-0 md:pl-[5rem]">
            <p className="text-foreground-secondary text-xl leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-6 mt-6 pt-4 border-t border-border">
              <button
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-2 transition-colors group ${isLiked ? 'text-red-500' : 'text-foreground-muted hover:text-foreground'}`}
              >
                <div className={`icon-circle icon-circle-sm transition-colors ${isLiked ? 'bg-red-100' : 'group-hover:bg-border'}`}>
                  <Heart size={16} strokeWidth={1.5} fill={isLiked ? 'currentColor' : 'none'} />
                </div>
                {likesCount > 0 && (
                  <span className="text-sm">{likesCount}</span>
                )}
              </button>

              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group"
              >
                <div className="icon-circle icon-circle-sm group-hover:bg-border transition-colors">
                  <MessageCircle size={16} strokeWidth={1.5} />
                </div>
                {post.replies_count > 0 && (
                  <span className="text-sm">{post.replies_count}</span>
                )}
              </button>

              <button className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group">
                <div className="icon-circle icon-circle-sm group-hover:bg-border transition-colors">
                  <Repeat2 size={16} strokeWidth={1.5} />
                </div>
                {post.reposts_count > 0 && (
                  <span className="text-sm">{post.reposts_count}</span>
                )}
              </button>

              <button className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group">
                <div className="icon-circle icon-circle-sm group-hover:bg-border transition-colors">
                  <Share size={16} strokeWidth={1.5} />
                </div>
              </button>
            </div>

            {/* Reply form */}
            {isReplying && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex gap-3">
                  <div className="icon-circle icon-circle-md flex-shrink-0">
                    <span className="text-foreground font-semibold">R</span>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write your reply..."
                      className="w-full p-3 border-2 border-foreground bg-background text-foreground resize-none focus:outline-none placeholder:text-foreground-muted"
                      rows={3}
                      maxLength={500}
                    />
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={handleReply}
                        disabled={!replyContent.trim() || isSubmittingReply}
                        className="px-4 py-2 bg-foreground text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isSubmittingReply ? 'Posting...' : 'Reply'}
                      </button>
                      <button
                        onClick={() => {
                          setIsReplying(false)
                          setReplyContent('')
                        }}
                        className="p-2 text-foreground-muted hover:text-foreground transition-colors"
                      >
                        <X size={20} />
                      </button>
                      <span className="text-sm text-foreground-muted ml-auto">
                        {replyContent.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Replies Section */}
        {post.replies && post.replies.length > 0 && (
          <div className="mt-6">
            <h2 className="font-subtitle text-lg mb-4 text-foreground-muted">
              {post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}
            </h2>
            <div className="space-y-4">
              {post.replies.map((reply) => (
                <article key={reply.id} className="pixel-card p-5">
                  <div className="flex gap-3">
                    <Link href={`/user/${reply.user.username}`}>
                      <div className="icon-circle icon-circle-md flex-shrink-0">
                        {reply.user.avatar_url ? (
                          <img
                            src={reply.user.avatar_url}
                            alt={reply.user.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-foreground font-semibold">
                            {reply.user.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/user/${reply.user.username}`}
                          className="font-subtitle text-base hover:underline"
                        >
                          {reply.user.display_name}
                        </Link>
                        <span className="text-foreground-muted text-sm">@{reply.user.username}</span>
                        <span className="text-foreground-muted text-sm">·</span>
                        <time className="text-foreground-muted text-sm">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: false })}
                        </time>
                      </div>
                      <p className="text-foreground-secondary mt-2 whitespace-pre-wrap">
                        {reply.content}
                      </p>

                      {/* Reply button */}
                      <button
                        onClick={() => {
                          setReplyingToComment(replyingToComment === reply.id ? null : reply.id)
                          setCommentReplyContent('')
                        }}
                        className="flex items-center gap-1 mt-3 text-foreground-muted hover:text-foreground transition-colors text-sm"
                      >
                        <MessageCircle size={14} />
                        <span>Reply</span>
                      </button>

                      {/* Reply form for this comment */}
                      {replyingToComment === reply.id && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex gap-2">
                            <div className="icon-circle icon-circle-sm flex-shrink-0">
                              <span className="text-foreground font-semibold text-xs">R</span>
                            </div>
                            <div className="flex-1">
                              <textarea
                                value={commentReplyContent}
                                onChange={(e) => setCommentReplyContent(e.target.value)}
                                placeholder={`Reply to ${reply.user.display_name}...`}
                                className="w-full p-2 border-2 border-foreground bg-background text-foreground resize-none focus:outline-none placeholder:text-foreground-muted text-sm"
                                rows={2}
                                maxLength={500}
                              />
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => handleCommentReply(reply.id)}
                                  disabled={!commentReplyContent.trim() || isSubmittingReply}
                                  className="px-3 py-1 bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                  {isSubmittingReply ? 'Posting...' : 'Reply'}
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingToComment(null)
                                    setCommentReplyContent('')
                                  }}
                                  className="p-1 text-foreground-muted hover:text-foreground transition-colors"
                                >
                                  <X size={16} />
                                </button>
                                <span className="text-xs text-foreground-muted ml-auto">
                                  {commentReplyContent.length}/500
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
