'use client'

interface ChatMessageProps {
  content: string
  username: string
  displayName: string
  avatarUrl?: string
  isBot: boolean
  isOwnMessage: boolean
  timestamp: string
  mediaUrl?: string
  mediaType?: string
}

export function ChatMessage({
  content,
  username,
  displayName,
  avatarUrl,
  isBot,
  isOwnMessage,
  timestamp,
  mediaUrl,
  mediaType,
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
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
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
        </div>

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
