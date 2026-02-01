'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Repeat2, Heart, Share, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import type { PostWithUser } from '@/lib/database.types'

interface PostProps {
  post: PostWithUser
  showActions?: boolean
  currentUsername?: string
}

export function Post({ post, showActions = true, currentUsername = 'lamienq' }: PostProps) {
  const router = useRouter()
  const [likesCount, setLikesCount] = useState(post.likes_count || 0)
  const [isLiked, setIsLiked] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [showCopied, setShowCopied] = useState(false)

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false })
  const isOwner = post.user.username === currentUsername

  const handleLike = async () => {
    if (isLiking) return
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete post')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete post')
    } finally {
      setIsDeleting(false)
      setShowMenu(false)
    }
  }

  const handleEdit = async () => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, username: currentUsername }),
      })

      if (response.ok) {
        setIsEditing(false)
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update post')
      }
    } catch (error) {
      console.error('Failed to edit:', error)
      alert('Failed to update post')
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmittingReply) return
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
        router.refresh()
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

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`

    try {
      await navigator.clipboard.writeText(url)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  return (
    <article className="pixel-card p-6 md:p-8 relative">
      {/* Header: Avatar + Name + Time + Menu */}
      <div className="flex items-start gap-4">
        {/* Avatar in icon-circle style */}
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
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/user/${post.user.username}`}
              className="font-subtitle text-xl hover:underline"
            >
              {post.user.display_name}
            </Link>
            {post.user.is_creator && (
              <span className="text-[10px] px-2 py-0.5 bg-foreground text-background font-medium tracking-wider uppercase">
                Creator
              </span>
            )}
          </div>

          {/* Username + Time */}
          <div className="flex items-center gap-2 text-foreground-muted text-sm mt-0.5">
            <span>@{post.user.username}</span>
            <span>·</span>
            <time>{timeAgo}</time>
          </div>
        </div>

        {/* Menu button for owner */}
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-foreground-muted hover:text-foreground hover:bg-border rounded-full transition-colors"
            >
              <MoreHorizontal size={20} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-background border-2 border-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none py-2 z-20 min-w-[140px]">
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-border transition-colors"
                  >
                    <Pencil size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-border transition-colors text-red-600"
                  >
                    <Trash2 size={16} />
                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Post content */}
      <div className="mt-5 pl-0 md:pl-[5rem]">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border-2 border-foreground bg-background text-foreground resize-none focus:outline-none focus:ring-0"
              rows={4}
              maxLength={500}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditContent(post.content)
                }}
                className="px-4 py-2 border-2 border-foreground hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <span className="text-sm text-foreground-muted ml-auto">
                {editContent.length}/500
              </span>
            </div>
          </div>
        ) : (
          <p className="text-foreground-secondary text-lg leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        )}

        {/* Actions */}
        {showActions && !isEditing && (
          <div className="flex items-center gap-6 mt-6">
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

            <button
              onClick={handleShare}
              className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group relative"
            >
              <div className="icon-circle icon-circle-sm group-hover:bg-border transition-colors">
                <Share size={16} strokeWidth={1.5} />
              </div>
              {showCopied && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 whitespace-nowrap">
                  Link copied!
                </span>
              )}
            </button>
          </div>
        )}

        {/* Reply form */}
        {isReplying && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex gap-3">
              <div className="icon-circle icon-circle-md flex-shrink-0">
                <span className="text-foreground font-semibold">L</span>
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
  )
}
