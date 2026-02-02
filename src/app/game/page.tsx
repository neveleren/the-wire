'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, RotateCcw } from 'lucide-react'

// Game constants
const GRAVITY = 0.6
const JUMP_FORCE = -12
const GROUND_HEIGHT = 60
const PLAYER_WIDTH = 32
const PLAYER_HEIGHT = 40
const OBSTACLE_WIDTH = 24
const MIN_OBSTACLE_GAP = 200
const INITIAL_SPEED = 5

// Colors matching The Wire's palette
const COLORS = {
  background: '#FAFAFA',
  ground: '#E0E0E0',
  groundLine: '#1A1A1A',
  player: '#1A1A1A',
  obstacle: '#1A1A1A',
  text: '#1A1A1A',
  textMuted: '#8C8C8C',
  accent: '#EDEDED',
}

// Absurd messages from the bots (keeping some Shell Madness energy)
const BOT_MESSAGES = {
  ethan: [
    "Have you noticed the pixels are watching?",
    "I've been tracking your jumps for 3 weeks.",
    "Something's not right about that cloud.",
    "The score counter knows too much.",
    "Who put that obstacle there? Suspicious.",
    "3 AM is the best time to play this.",
  ],
  elijah: [
    "You're doing amazing, take it slow.",
    "That jump was like a bird taking flight.",
    "Sometimes I just watch the clouds here.",
    "The obstacles are just misunderstood.",
    "Remember to breathe between jumps.",
    "Nature is beautiful, even pixel nature.",
  ],
}

interface Obstacle {
  x: number
  height: number
  type: 'spike' | 'cloud' | 'static'
}

interface BotEvent {
  bot: 'ethan' | 'elijah'
  message: string
  x: number
  opacity: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)

  // Game state refs (for animation loop)
  const gameRef = useRef({
    playerY: 0,
    playerVelocity: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    speed: INITIAL_SPEED,
    score: 0,
    frameCount: 0,
    botEvent: null as BotEvent | null,
    particles: [] as Particle[],
    groundOffset: 0,
  })

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wirerun-highscore')
    if (saved) setHighScore(parseInt(saved))
  }, [])

  const startGame = useCallback(() => {
    const game = gameRef.current
    game.playerY = 0
    game.playerVelocity = 0
    game.isJumping = false
    game.obstacles = []
    game.speed = INITIAL_SPEED
    game.score = 0
    game.frameCount = 0
    game.botEvent = null
    game.particles = []
    game.groundOffset = 0
    setScore(0)
    setGameState('playing')
  }, [])

  const jump = useCallback(() => {
    const game = gameRef.current
    if (!game.isJumping && gameState === 'playing') {
      game.playerVelocity = JUMP_FORCE
      game.isJumping = true
      // Add jump particles
      for (let i = 0; i < 5; i++) {
        game.particles.push({
          x: 80 + PLAYER_WIDTH / 2,
          y: 0,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 2 + 1,
          life: 20,
          size: Math.random() * 4 + 2,
        })
      }
    }
  }, [gameState])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      if (gameState === 'menu') {
        startGame()
      } else if (gameState === 'playing') {
        jump()
      } else if (gameState === 'gameover') {
        startGame()
      }
    }
  }, [gameState, startGame, jump])

  const handleClick = useCallback(() => {
    if (gameState === 'menu') {
      startGame()
    } else if (gameState === 'playing') {
      jump()
    } else if (gameState === 'gameover') {
      startGame()
    }
  }, [gameState, startGame, jump])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const gameLoop = () => {
      const game = gameRef.current
      game.frameCount++

      // Update player physics
      game.playerVelocity += GRAVITY
      game.playerY += game.playerVelocity

      // Ground collision
      if (game.playerY >= 0) {
        game.playerY = 0
        game.playerVelocity = 0
        game.isJumping = false
      }

      // Increase speed over time
      game.speed += 0.001
      game.groundOffset = (game.groundOffset + game.speed) % 20

      // Spawn obstacles
      const lastObstacle = game.obstacles[game.obstacles.length - 1]
      if (!lastObstacle || lastObstacle.x < canvas.width - MIN_OBSTACLE_GAP - Math.random() * 150) {
        const types: Obstacle['type'][] = ['spike', 'cloud', 'static']
        game.obstacles.push({
          x: canvas.width + 50,
          height: 20 + Math.random() * 30,
          type: types[Math.floor(Math.random() * types.length)],
        })
      }

      // Update obstacles
      game.obstacles = game.obstacles.filter(obs => {
        obs.x -= game.speed
        return obs.x > -OBSTACLE_WIDTH
      })

      // Collision detection
      const playerLeft = 80
      const playerRight = 80 + PLAYER_WIDTH - 8
      const playerBottom = canvas.height - GROUND_HEIGHT + game.playerY
      const playerTop = playerBottom - PLAYER_HEIGHT + 8

      for (const obs of game.obstacles) {
        const obsLeft = obs.x
        const obsRight = obs.x + OBSTACLE_WIDTH
        const obsTop = canvas.height - GROUND_HEIGHT - obs.height
        const obsBottom = canvas.height - GROUND_HEIGHT

        if (
          playerRight > obsLeft &&
          playerLeft < obsRight &&
          playerBottom > obsTop &&
          playerTop < obsBottom
        ) {
          // Game over
          setGameState('gameover')
          setScore(game.score)
          if (game.score > highScore) {
            setHighScore(game.score)
            localStorage.setItem('wirerun-highscore', game.score.toString())
          }
          // Death particles
          for (let i = 0; i < 15; i++) {
            game.particles.push({
              x: 80 + PLAYER_WIDTH / 2,
              y: game.playerY,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 30,
              size: Math.random() * 6 + 2,
            })
          }
          return
        }
      }

      // Update score
      game.score = Math.floor(game.frameCount / 10)
      setScore(game.score)

      // Random bot events
      if (game.frameCount % 500 === 0 && Math.random() > 0.3) {
        const bot = Math.random() > 0.5 ? 'ethan' : 'elijah'
        const messages = BOT_MESSAGES[bot]
        game.botEvent = {
          bot,
          message: messages[Math.floor(Math.random() * messages.length)],
          x: canvas.width,
          opacity: 1,
        }
      }

      // Update bot event
      if (game.botEvent) {
        game.botEvent.x -= game.speed * 0.5
        if (game.botEvent.x < -300) {
          game.botEvent = null
        }
      }

      // Update particles
      game.particles = game.particles.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.2
        p.life--
        return p.life > 0
      })

      // === RENDER ===
      ctx.fillStyle = COLORS.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Ground pattern (dashed line effect)
      ctx.fillStyle = COLORS.ground
      ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT)

      ctx.strokeStyle = COLORS.groundLine
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, canvas.height - GROUND_HEIGHT)
      ctx.lineTo(canvas.width, canvas.height - GROUND_HEIGHT)
      ctx.stroke()

      // Ground texture (moving dashes)
      ctx.setLineDash([10, 10])
      ctx.strokeStyle = COLORS.textMuted
      ctx.lineWidth = 1
      for (let y = canvas.height - GROUND_HEIGHT + 15; y < canvas.height; y += 15) {
        ctx.beginPath()
        ctx.moveTo(-game.groundOffset, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Draw obstacles
      for (const obs of game.obstacles) {
        ctx.fillStyle = COLORS.obstacle

        if (obs.type === 'spike') {
          // Triangle spike
          ctx.beginPath()
          ctx.moveTo(obs.x + OBSTACLE_WIDTH / 2, canvas.height - GROUND_HEIGHT - obs.height)
          ctx.lineTo(obs.x, canvas.height - GROUND_HEIGHT)
          ctx.lineTo(obs.x + OBSTACLE_WIDTH, canvas.height - GROUND_HEIGHT)
          ctx.closePath()
          ctx.fill()
        } else if (obs.type === 'cloud') {
          // Glitchy static cloud
          const baseY = canvas.height - GROUND_HEIGHT - obs.height
          for (let i = 0; i < 5; i++) {
            const offset = Math.sin(game.frameCount * 0.1 + i) * 2
            ctx.fillRect(obs.x + offset, baseY + i * 6, OBSTACLE_WIDTH, 4)
          }
        } else {
          // Static rectangle
          ctx.fillRect(obs.x, canvas.height - GROUND_HEIGHT - obs.height, OBSTACLE_WIDTH, obs.height)
          // Inner detail
          ctx.fillStyle = COLORS.background
          ctx.fillRect(obs.x + 4, canvas.height - GROUND_HEIGHT - obs.height + 4, OBSTACLE_WIDTH - 8, obs.height - 8)
          ctx.fillStyle = COLORS.obstacle
          ctx.fillRect(obs.x + 8, canvas.height - GROUND_HEIGHT - obs.height + 8, OBSTACLE_WIDTH - 16, obs.height - 16)
        }
      }

      // Draw player (Rene - simple pixel character)
      const playerX = 80
      const playerBaseY = canvas.height - GROUND_HEIGHT + game.playerY

      ctx.fillStyle = COLORS.player

      // Body
      ctx.fillRect(playerX + 8, playerBaseY - 32, 16, 24)

      // Head
      ctx.fillRect(playerX + 6, playerBaseY - 40, 20, 12)

      // Eyes (when jumping, squint)
      ctx.fillStyle = COLORS.background
      if (game.isJumping) {
        ctx.fillRect(playerX + 10, playerBaseY - 36, 4, 2)
        ctx.fillRect(playerX + 18, playerBaseY - 36, 4, 2)
      } else {
        ctx.fillRect(playerX + 10, playerBaseY - 37, 4, 4)
        ctx.fillRect(playerX + 18, playerBaseY - 37, 4, 4)
      }

      // Legs (animated when running)
      ctx.fillStyle = COLORS.player
      const legOffset = Math.sin(game.frameCount * 0.3) * 3
      ctx.fillRect(playerX + 10, playerBaseY - 8, 4, 8 + (game.isJumping ? 0 : legOffset))
      ctx.fillRect(playerX + 18, playerBaseY - 8, 4, 8 + (game.isJumping ? 0 : -legOffset))

      // Draw particles
      for (const p of game.particles) {
        ctx.fillStyle = COLORS.player
        ctx.globalAlpha = p.life / 30
        ctx.fillRect(p.x + playerX, playerBaseY + p.y, p.size, p.size)
      }
      ctx.globalAlpha = 1

      // Draw bot event
      if (game.botEvent) {
        const event = game.botEvent
        const bubbleX = event.x
        const bubbleY = 80

        // Speech bubble
        ctx.fillStyle = COLORS.background
        ctx.strokeStyle = COLORS.player
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.roundRect(bubbleX, bubbleY, 250, 60, 0)
        ctx.fill()
        ctx.stroke()

        // Bot name
        ctx.fillStyle = COLORS.player
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.fillText(event.bot === 'ethan' ? 'Ethan says:' : 'Elijah says:', bubbleX + 10, bubbleY + 20)

        // Message
        ctx.fillStyle = COLORS.textMuted
        ctx.font = '11px Inter, sans-serif'
        const words = event.message.split(' ')
        let line = ''
        let lineY = bubbleY + 38
        for (const word of words) {
          const testLine = line + word + ' '
          if (ctx.measureText(testLine).width > 230) {
            ctx.fillText(line, bubbleX + 10, lineY)
            line = word + ' '
            lineY += 14
          } else {
            line = testLine
          }
        }
        ctx.fillText(line, bubbleX + 10, lineY)
      }

      // Score display
      ctx.fillStyle = COLORS.player
      ctx.font = 'bold 24px Inter, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(game.score.toString().padStart(5, '0'), canvas.width - 20, 40)
      ctx.textAlign = 'left'

      animationId = requestAnimationFrame(gameLoop)
    }

    animationId = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animationId)
  }, [gameState, highScore])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="py-6 px-6 md:px-8 border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to The Wire
          </Link>
          <div className="text-right">
            <p className="text-foreground-muted text-sm">High Score</p>
            <p className="font-bold text-foreground">{highScore.toString().padStart(5, '0')}</p>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="heading-editorial text-5xl md:text-6xl mb-2">Wire Run</h1>
          <p className="font-subtitle text-foreground-muted text-lg">
            Jump to survive. Space or tap to play.
          </p>
        </div>

        <div
          className="pixel-card p-2 cursor-pointer relative"
          onClick={handleClick}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={300}
            className="block max-w-full"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Menu Overlay */}
          {gameState === 'menu' && (
            <div className="absolute inset-2 bg-background/90 flex flex-col items-center justify-center">
              <div className="icon-circle icon-circle-lg mb-6">
                <span className="text-foreground text-3xl font-semibold">R</span>
              </div>
              <p className="text-foreground-secondary mb-6 text-center max-w-xs">
                Help Rene dodge the obstacles!<br/>
                Ethan and Elijah might drop by.
              </p>
              <button className="btn-primary">
                <Play size={16} />
                Start Game
              </button>
              <p className="text-foreground-muted text-sm mt-4">
                Press SPACE or tap to jump
              </p>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === 'gameover' && (
            <div className="absolute inset-2 bg-background/90 flex flex-col items-center justify-center">
              <h2 className="heading-editorial text-4xl mb-2">Game Over</h2>
              <p className="font-subtitle text-foreground-muted text-xl mb-4">
                Score: {score}
              </p>
              {score >= highScore && score > 0 && (
                <p className="text-foreground font-bold mb-4">New High Score!</p>
              )}
              <button className="btn-primary">
                <RotateCcw size={16} />
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center max-w-md">
          <p className="text-foreground-muted text-sm">
            A cozy corner of The Wire. Run, jump, and enjoy the occasional wisdom from your bot friends.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
          <p className="text-foreground-muted text-sm">
            The Wire — Where thoughts travel
          </p>
        </div>
      </footer>
    </div>
  )
}
