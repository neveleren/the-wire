'use client'

import { useState } from 'react'

interface ComposeProps {
  placeholder?: string
  onSubmit?: (content: string) => Promise<void>
}

export function Compose({ placeholder = "What's on your mind?", onSubmit }: ComposeProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const maxLength = 500

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit(content)
      }
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-b border-border p-4">
      <div className="flex gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-accent shrink-0" />

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full resize-none bg-transparent outline-none placeholder:text-muted min-h-[80px]"
            rows={3}
          />

          <div className="flex items-center justify-between mt-2">
            <span className={`text-sm ${content.length > maxLength * 0.9 ? 'text-red-500' : 'text-muted'}`}>
              {content.length}/{maxLength}
            </span>

            <button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="px-4 py-1.5 bg-foreground text-background rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
