'use client'

import { Reply } from 'lucide-react'

interface ChatMessageProps {
  id: string
  content: string
  username: string
  displayName: string
  avatarUrl?: string
  isBot: boolean
  isOwnMessage: boolean
  timestamp: string
  mediaUrl?: string
  mediaType?: string
  replyTo?: {
    displayName: string
    content: string
  }
  onReply?: (id: string, displayName: string) => void
}

export function ChatMessage({
  id,
  content,
  username,
  displayName,
  avatarUrl,
  isBot,
  isOwnMessage,
  timestamp,
  mediaUrl,
  mediaType,
  replyTo,
  onReply,
}: ChatMessageProps) {
  const formattedTime = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Detect URLs in content for link display
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const contentWithLinks = content.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline hover:no-underline"
        >
          {part}
        </a>
      )
    }
    return part
  })

  return (
    <div className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="icon-circle icon-circle-sm"
          />
        ) : (
          <div className="icon-circle icon-circle-sm bg-border">
            <span className="text-xs font-medium">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Message bubble */}
      <div className={`max-w-[75%] ${isOwnMessage ? 'text-right' : 'text-left'}`}>
        {/* Name and time */}
        <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs font-medium">
            {displayName}
            {isBot && <span className="ml-1 text-foreground-muted">(bot)</span>}
          </span>
          <span className="text-xs text-foreground-muted">{formattedTime}</span>
          {/* Reply button - shows on hover */}
          {onReply && (
            <button
              onClick={() => onReply(id, displayName)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-border rounded"
              title="Reply"
            >
              <Reply size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Reply reference */}
        {replyTo && (
          <div className={`flex items-center gap-1.5 mb-1 text-xs text-foreground-muted ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            <Reply size={12} strokeWidth={1.5} className="rotate-180" />
            <span>Reply to <span className="font-medium">{replyTo.displayName}</span></span>
          </div>
        )}

        {/* Replied message preview */}
        {replyTo && (
          <div className={`mb-1 px-3 py-1.5 border-l-2 border-foreground-muted/50 bg-background-alt/50 text-xs text-foreground-muted ${isOwnMessage ? 'ml-auto' : ''}`} style={{ maxWidth: 'fit-content' }}>
            <p className="line-clamp-1">{replyTo.content}</p>
          </div>
        )}

        {/* Message content */}
        <div
          className={`inline-block px-4 py-2 border border-border ${
            isOwnMessage
              ? 'bg-foreground text-background'
              : 'bg-background-alt'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{contentWithLinks}</p>

          {/* Media preview */}
          {mediaUrl && mediaType === 'image' && (
            <img
              src={mediaUrl}
              alt="Shared image"
              className="mt-2 max-w-full rounded border border-border"
              style={{ maxHeight: '200px' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
