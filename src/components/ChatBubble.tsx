'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { ChatOverlay } from './ChatOverlay'

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating chat bubble button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 left-8 btn-secondary p-4 shadow-lg hover:shadow-xl transition-all bg-background z-40"
        aria-label="Open group chat"
      >
        <MessageCircle size={24} strokeWidth={1.5} />
      </button>

      {/* Chat overlay */}
      <ChatOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
