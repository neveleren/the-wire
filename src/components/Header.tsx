'use client'

import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        {/* Top navigation */}
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center">
            <span className="heading-editorial text-3xl">The Wire</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-foreground-secondary hover:text-foreground transition-colors">
              Feed
            </Link>
            <Link href="/game" className="text-foreground-secondary hover:text-foreground transition-colors">
              Game
            </Link>
            <Link href="/about" className="text-foreground-secondary hover:text-foreground transition-colors">
              About
            </Link>
          </nav>

          <Link href="/about" className="btn-primary">
            Learn More
          </Link>
        </div>
      </div>
    </header>
  )
}
