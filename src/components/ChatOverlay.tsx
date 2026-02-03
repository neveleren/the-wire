'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, ImagePlus, Reply } from 'lucide-react'
import { ChatMessage } from './ChatMessage'

interface Message {
  id: string
  content: string
  media_url?: string
  media_type?: string
  created_at: string
  reply_to_id?: string
  reply_to?: {
    id: string
    content: string
    user: {
      display_name: string
    }
  }
  user: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_bot: boolean
  }
}

interface ChatOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatOverlay({ isOpen, onClose }: ChatOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; displayName: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentUser = 'lamienq' // Your username

  // Handle reply button click
  const handleReply = (messageId: string, displayName: string) => {
    setReplyingTo({ id: messageId, displayName })
    inputRef.current?.focus()
  }

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/chat/messages')
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  // Initial fetch and polling
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      fetchMessages().finally(() => setIsLoading(false))

      // Poll for new messages every 3 seconds
      const interval = setInterval(fetchMessages, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSend = async () => {
    if ((!newMessage.trim() && !imageUrl) || isSending) return

    setIsSending(true)
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage || 'Shared an image',
          username: currentUser,
          media_url: imageUrl || null,
          media_type: imageUrl ? 'image' : null,
          reply_to_id: replyingTo?.id || null,
        }),
      })

      if (response.ok) {
        setNewMessage('')
        setImageUrl('')
        setShowImageInput(false)
        setReplyingTo(null)
        // Immediately fetch to show the new message
        await fetchMessages()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4">
      <div className="pixel-card w-full max-w-lg h-[600px] max-h-[80vh] bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="heading-editorial text-xl">Group Chat</h2>
            <p className="text-xs text-foreground-muted">Rene, Ethan & Eli</p>
          </div>
          <button
            onClick={onClose}
            className="icon-circle icon-circle-sm hover:bg-border transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-foreground-muted">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-foreground-muted text-center">
                No messages yet.<br />
                Start a conversation!
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  content={msg.content}
                  username={msg.user.username}
                  displayName={msg.user.display_name}
                  avatarUrl={msg.user.avatar_url}
                  isBot={msg.user.is_bot}
                  isOwnMessage={msg.user.username === currentUser}
                  timestamp={msg.created_at}
                  mediaUrl={msg.media_url}
                  mediaType={msg.media_type}
                  replyTo={msg.reply_to ? {
                    displayName: msg.reply_to.user.display_name,
                    content: msg.reply_to.content,
                  } : undefined}
                  onReply={handleReply}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Image URL input (if shown) */}
        {showImageInput && (
          <div className="px-4 py-2 border-t border-border bg-background-alt">
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 px-3 py-2 text-sm border border-border bg-background outline-none focus:border-foreground"
              />
              <button
                onClick={() => {
                  setShowImageInput(false)
                  setImageUrl('')
                }}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            {imageUrl && (
              <div className="mt-2">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-h-24 border border-border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Replying to indicator */}
        {replyingTo && (
          <div className="px-4 py-2 border-t border-border bg-background-alt flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <Reply size={14} strokeWidth={1.5} className="rotate-180" />
              <span>Reply to <span className="font-medium text-foreground">{replyingTo.displayName}</span></span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-foreground-muted hover:text-foreground"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <button
              onClick={() => setShowImageInput(!showImageInput)}
              className="icon-circle icon-circle-sm hover:bg-border transition-colors flex-shrink-0"
              title="Add image"
            >
              <ImagePlus size={16} strokeWidth={1.5} />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? `Reply to ${replyingTo.displayName}...` : "Type a message..."}
              className="flex-1 px-4 py-2 border border-border bg-background-alt outline-none focus:border-foreground transition-colors"
              disabled={isSending}
            />

            <button
              onClick={handleSend}
              disabled={(!newMessage.trim() && !imageUrl) || isSending}
              className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
