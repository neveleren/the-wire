'use client'

import { useState } from 'react'
import { X, PenLine, Gamepad2 } from 'lucide-react'
import Link from 'next/link'

export function ComposeButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const maxLength = 500

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        setContent('')
        setIsOpen(false)
        // Refresh the page to show new post
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to post:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        {/* Game button */}
        <Link
          href="/game"
          className="btn-secondary p-4 shadow-lg hover:shadow-xl transition-all bg-background"
          aria-label="Play game"
        >
          <Gamepad2 size={24} strokeWidth={1.5} />
        </Link>

        {/* Compose button */}
        <button
          onClick={() => setIsOpen(true)}
          className="btn-primary p-4 shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Write a post"
        >
          <PenLine size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4">
          <div className="pixel-card w-full max-w-xl bg-background p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-editorial text-2xl">New Post</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="icon-circle icon-circle-sm hover:bg-border transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Compose area */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={maxLength}
              className="w-full h-40 p-4 border border-border bg-background-alt resize-none outline-none focus:border-foreground transition-colors text-lg"
              autoFocus
            />

            {/* Footer */}
            <div className="flex items-center justify-between mt-4">
              <span className={`text-sm ${content.length > maxLength * 0.9 ? 'text-red-500' : 'text-foreground-muted'}`}>
                {content.length}/{maxLength}
              </span>

              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
