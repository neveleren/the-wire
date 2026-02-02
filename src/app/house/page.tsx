'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, DoorOpen } from 'lucide-react'

// Colors matching The Wire's palette
const COLORS = {
  background: '#FAFAFA',
  backgroundAlt: '#F5F5F5',
  ground: '#E0E0E0',
  groundLine: '#1A1A1A',
  player: '#1A1A1A',
  text: '#1A1A1A',
  textMuted: '#8C8C8C',
  accent: '#EDEDED',
  wall: '#F0EDE8',
  floor: '#D4C4B0',
  furniture: '#3A3A3A',
  window: '#87CEEB',
  windowNight: '#1A1A2A',
  windowEvening: '#FFB366',
}

type RoomId = 'main' | 'ethan' | 'elijah' | 'kitchen'

interface Room {
  id: RoomId
  name: string
  doors: { x: number; targetRoom: RoomId; label: string }[]
}

const ROOMS: Record<RoomId, Room> = {
  main: {
    id: 'main',
    name: 'Living Room',
    doors: [
      { x: 80, targetRoom: 'ethan', label: "Ethan's" },
      { x: 270, targetRoom: 'kitchen', label: 'Kitchen' },
      { x: 460, targetRoom: 'elijah', label: "Elijah's" },
    ],
  },
  ethan: {
    id: 'ethan',
    name: "Ethan's Room",
    doors: [{ x: 460, targetRoom: 'main', label: 'Living Room' }],
  },
  elijah: {
    id: 'elijah',
    name: "Elijah's Room",
    doors: [{ x: 80, targetRoom: 'main', label: 'Living Room' }],
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    doors: [{ x: 460, targetRoom: 'main', label: 'Living Room' }],
  },
}

export default function HousePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'opening' | 'playing'>('opening')
  const [currentRoom, setCurrentRoom] = useState<RoomId>('main')
  const [playerX, setPlayerX] = useState(300)
  const [facingRight, setFacingRight] = useState(true)
  const [time, setTime] = useState(() => new Date())

  const keysPressed = useRef<Set<string>>(new Set())
  const frameRef = useRef(0)

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const getTimeOfDay = useCallback(() => {
    const hour = time.getHours()
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 20) return 'evening'
    return 'night'
  }, [time])

  // Keyboard controls
  useEffect(() => {
    if (gameState !== 'playing') return

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase())
      if (e.key === 'ArrowLeft' || e.key === 'a') setFacingRight(false)
      if (e.key === 'ArrowRight' || e.key === 'd') setFacingRight(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameState])

  // Game/render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const render = () => {
      frameRef.current++
      const frame = frameRef.current

      // Player movement
      if (gameState === 'playing') {
        const speed = 3
        if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) {
          setPlayerX(prev => Math.max(30, prev - speed))
        }
        if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) {
          setPlayerX(prev => Math.min(570, prev + speed))
        }
      }

      // Clear
      ctx.fillStyle = COLORS.background
      ctx.fillRect(0, 0, 600, 300)

      if (gameState === 'opening') {
        drawOpeningScene(ctx, frame)
      } else {
        drawRoom(ctx, frame)
      }

      animationId = requestAnimationFrame(render)
    }

    const drawOpeningScene = (ctx: CanvasRenderingContext2D, frame: number) => {
      // Dark sky
      ctx.fillStyle = '#2A2A2A'
      ctx.fillRect(0, 0, 600, 300)

      // Moving clouds
      ctx.fillStyle = '#3A3A3A'
      for (let i = 0; i < 4; i++) {
        const cloudX = ((frame * 0.3 + i * 200) % 800) - 100
        ctx.beginPath()
        ctx.ellipse(cloudX, 40 + i * 15, 60, 20, 0, 0, Math.PI * 2)
        ctx.ellipse(cloudX + 30, 45 + i * 15, 40, 15, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Hill
      ctx.fillStyle = '#2D2D2D'
      ctx.beginPath()
      ctx.moveTo(0, 300)
      ctx.quadraticCurveTo(300, 160, 600, 300)
      ctx.fill()

      // House
      const houseX = 240
      const houseY = 170

      // House body
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(houseX, houseY, 120, 80)

      // Roof
      ctx.beginPath()
      ctx.moveTo(houseX - 15, houseY)
      ctx.lineTo(houseX + 60, houseY - 45)
      ctx.lineTo(houseX + 135, houseY)
      ctx.closePath()
      ctx.fill()

      // Windows with warm glow
      ctx.fillStyle = '#FFE4B5'
      ctx.shadowColor = '#FFE4B5'
      ctx.shadowBlur = 15
      ctx.fillRect(houseX + 15, houseY + 15, 25, 25)
      ctx.fillRect(houseX + 80, houseY + 15, 25, 25)
      ctx.shadowBlur = 0

      // Door
      ctx.fillStyle = '#0A0A0A'
      ctx.fillRect(houseX + 45, houseY + 35, 30, 45)

      // Chimney
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(houseX + 90, houseY - 30, 18, 35)

      // Rain
      ctx.strokeStyle = '#5A5A5A'
      ctx.lineWidth = 1
      for (let i = 0; i < 80; i++) {
        const rainX = (i * 8 + frame * 2) % 620 - 10
        const rainY = (i * 17 + frame * 5) % 320 - 20
        ctx.beginPath()
        ctx.moveTo(rainX, rainY)
        ctx.lineTo(rainX - 2, rainY + 12)
        ctx.stroke()
      }

      // Swaying grass
      ctx.strokeStyle = '#252525'
      for (let i = 0; i < 40; i++) {
        const grassX = 50 + i * 13
        const baseY = 220 + Math.abs(grassX - 300) / 8
        const sway = Math.sin(frame * 0.05 + i) * 3
        ctx.beginPath()
        ctx.moveTo(grassX, baseY + 30)
        ctx.lineTo(grassX + sway, baseY + 15)
        ctx.stroke()
      }
    }

    const drawRoom = (ctx: CanvasRenderingContext2D, frame: number) => {
      const room = ROOMS[currentRoom]
      const timeOfDay = getTimeOfDay()

      // Wall
      ctx.fillStyle = COLORS.wall
      ctx.fillRect(0, 0, 600, 220)

      // Floor
      ctx.fillStyle = COLORS.floor
      ctx.fillRect(0, 220, 600, 80)

      // Floor line
      ctx.strokeStyle = COLORS.groundLine
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, 220)
      ctx.lineTo(600, 220)
      ctx.stroke()

      // Floor boards
      ctx.strokeStyle = '#C0B0A0'
      ctx.lineWidth = 1
      for (let i = 1; i < 8; i++) {
        ctx.beginPath()
        ctx.moveTo(i * 75, 220)
        ctx.lineTo(i * 75, 300)
        ctx.stroke()
      }

      // Draw room-specific content
      if (currentRoom === 'main') {
        drawMainRoom(ctx, frame, timeOfDay)
      } else if (currentRoom === 'ethan') {
        drawEthanRoom(ctx, frame, timeOfDay)
      } else if (currentRoom === 'elijah') {
        drawElijahRoom(ctx, frame, timeOfDay)
      } else {
        drawKitchen(ctx, frame, timeOfDay)
      }

      // Draw doors
      room.doors.forEach(door => {
        ctx.fillStyle = COLORS.player
        ctx.fillRect(door.x - 3, 130, 46, 93)
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(door.x, 133, 40, 87)
        // Handle
        ctx.fillStyle = COLORS.textMuted
        ctx.beginPath()
        ctx.arc(door.x + 32, 175, 3, 0, Math.PI * 2)
        ctx.fill()
        // Label
        ctx.fillStyle = COLORS.textMuted
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(door.label, door.x + 20, 125)
      })

      // Draw player
      drawPlayer(ctx, playerX, 175, facingRight, frame)

      // Room name
      ctx.fillStyle = COLORS.player
      ctx.font = 'bold 14px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(room.name.toUpperCase(), 15, 25)

      // Time
      ctx.textAlign = 'right'
      ctx.font = '12px Inter, sans-serif'
      ctx.fillText(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 585, 25)

      // Time overlay
      if (timeOfDay === 'evening') {
        ctx.fillStyle = 'rgba(255, 180, 100, 0.08)'
        ctx.fillRect(0, 0, 600, 300)
      } else if (timeOfDay === 'night') {
        ctx.fillStyle = 'rgba(20, 20, 40, 0.2)'
        ctx.fillRect(0, 0, 600, 300)
      }
    }

    const drawWindow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, timeOfDay: string) => {
      // Frame
      ctx.fillStyle = '#D0C8C0'
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8)
      // Glass
      ctx.fillStyle = timeOfDay === 'night' ? COLORS.windowNight : timeOfDay === 'evening' ? COLORS.windowEvening : COLORS.window
      ctx.fillRect(x, y, w, h)
      // Panes
      ctx.strokeStyle = COLORS.textMuted
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w / 2, y + h)
      ctx.moveTo(x, y + h / 2)
      ctx.lineTo(x + w, y + h / 2)
      ctx.stroke()
    }

    const drawMainRoom = (ctx: CanvasRenderingContext2D, frame: number, timeOfDay: string) => {
      // Windows
      drawWindow(ctx, 160, 50, 70, 55, timeOfDay)
      drawWindow(ctx, 370, 50, 70, 55, timeOfDay)

      // TV
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(280, 140, 40, 35)
      ctx.fillStyle = '#2A3A2A'
      ctx.fillRect(283, 143, 34, 26)
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(270, 175, 60, 15)

      // Sofa
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(255, 190, 90, 30)
      ctx.fillRect(255, 175, 90, 18)
      ctx.fillRect(248, 180, 12, 40)
      ctx.fillRect(340, 180, 12, 40)

      // Lamps
      const drawLamp = (lx: number) => {
        ctx.fillStyle = COLORS.furniture
        ctx.fillRect(lx + 8, 200, 4, 20)
        ctx.fillStyle = '#E8E0D8'
        ctx.beginPath()
        ctx.moveTo(lx, 200)
        ctx.lineTo(lx + 20, 200)
        ctx.lineTo(lx + 17, 180)
        ctx.lineTo(lx + 3, 180)
        ctx.closePath()
        ctx.fill()
        if (timeOfDay === 'night' || timeOfDay === 'evening') {
          ctx.fillStyle = 'rgba(255, 230, 180, 0.25)'
          ctx.beginPath()
          ctx.ellipse(lx + 10, 210, 25, 35, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      drawLamp(200)
      drawLamp(380)

      // Plant
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(545, 195, 25, 25)
      ctx.fillStyle = '#2D5A2D'
      ctx.beginPath()
      ctx.ellipse(557, 180, 18, 25, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawEthanRoom = (ctx: CanvasRenderingContext2D, frame: number, timeOfDay: string) => {
      // Duct-taped window
      ctx.fillStyle = '#D0C8C0'
      ctx.fillRect(216, 46, 78, 63)
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(220, 50, 70, 55)
      // Tape X
      ctx.strokeStyle = '#8A8A7A'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(220, 50)
      ctx.lineTo(290, 105)
      ctx.moveTo(290, 50)
      ctx.lineTo(220, 105)
      ctx.stroke()

      // Messy bed
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(60, 180, 90, 40)
      ctx.fillRect(60, 160, 15, 60)
      ctx.fillStyle = '#5A5A5A'
      ctx.fillRect(75, 185, 70, 30)

      // Computer desk
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(350, 175, 70, 8)
      ctx.fillRect(355, 183, 8, 37)
      ctx.fillRect(405, 183, 8, 37)
      // Monitor
      ctx.fillStyle = COLORS.player
      ctx.fillRect(365, 140, 40, 35)
      ctx.fillStyle = '#2A4A2A'
      ctx.fillRect(368, 143, 34, 27)

      // Trash scattered
      ctx.fillStyle = '#5A5A5A'
      for (const pos of [[180, 210], [220, 205], [300, 215], [130, 200]]) {
        ctx.beginPath()
        ctx.ellipse(pos[0], pos[1], 12, 8, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Weird posters
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(100, 60, 35, 50)
      ctx.fillRect(320, 55, 45, 60)
      ctx.fillStyle = '#3A3A3A'
      ctx.fillRect(103, 63, 29, 44)
      ctx.fillRect(323, 58, 39, 54)
    }

    const drawElijahRoom = (ctx: CanvasRenderingContext2D, frame: number, timeOfDay: string) => {
      // Nice big window
      drawWindow(ctx, 250, 45, 100, 70, timeOfDay)

      // Neat bed
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(450, 180, 90, 40)
      ctx.fillRect(450, 160, 15, 60)
      ctx.fillStyle = '#E8E0D8'
      ctx.fillRect(465, 185, 35, 20)
      ctx.fillStyle = '#5A5A5A'
      ctx.fillRect(465, 190, 70, 25)

      // Desk with laptop
      ctx.fillStyle = '#5A5A5A'
      ctx.fillRect(160, 180, 70, 8)
      ctx.fillRect(165, 188, 8, 32)
      ctx.fillRect(215, 188, 8, 32)
      // Laptop
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(175, 160, 40, 25)
      ctx.fillStyle = '#3A4A4A'
      ctx.fillRect(178, 163, 34, 19)

      // Bookshelf
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(450, 70, 60, 90)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(450, 90 + i * 25, 60, 4)
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = `hsl(0, 0%, ${25 + j * 10}%)`
          ctx.fillRect(454 + j * 13, 70 + i * 25, 10, 20)
        }
      }

      // Bird stand
      ctx.fillStyle = '#5A5A5A'
      ctx.fillRect(380, 170, 4, 50)
      ctx.fillRect(365, 218, 34, 6)
      ctx.fillRect(362, 170, 40, 4)

      // Plant
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(145, 200, 20, 20)
      ctx.fillStyle = '#2D5A2D'
      ctx.beginPath()
      ctx.ellipse(155, 188, 15, 20, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawKitchen = (ctx: CanvasRenderingContext2D, frame: number, timeOfDay: string) => {
      // Window
      drawWindow(ctx, 160, 50, 80, 60, timeOfDay)

      // Fridge
      ctx.fillStyle = '#E0D8D0'
      ctx.fillRect(60, 120, 50, 100)
      ctx.strokeStyle = COLORS.textMuted
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(60, 165)
      ctx.lineTo(110, 165)
      ctx.stroke()
      ctx.fillStyle = '#666'
      ctx.fillRect(100, 140, 4, 15)
      ctx.fillRect(100, 180, 4, 15)

      // Counter
      ctx.fillStyle = '#D8D0C8'
      ctx.fillRect(130, 175, 150, 12)
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(130, 187, 150, 33)

      // Stove
      ctx.fillStyle = '#2A2A2A'
      ctx.fillRect(200, 145, 55, 35)
      ctx.fillStyle = COLORS.player
      ctx.beginPath()
      ctx.arc(215, 160, 8, 0, Math.PI * 2)
      ctx.arc(240, 160, 8, 0, Math.PI * 2)
      ctx.fill()

      // Table
      ctx.fillStyle = '#5A5A4A'
      ctx.fillRect(350, 185, 80, 8)
      ctx.fillRect(360, 193, 8, 27)
      ctx.fillRect(412, 193, 8, 27)
    }

    const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, right: boolean, frame: number) => {
      ctx.save()
      if (!right) {
        ctx.translate(x + 16, 0)
        ctx.scale(-1, 1)
        ctx.translate(-x - 16, 0)
      }

      const walking = keysPressed.current.size > 0
      const bob = walking ? Math.sin(frame * 0.3) * 2 : 0

      // Body
      ctx.fillStyle = COLORS.furniture
      ctx.fillRect(x + 4, y + 18 + bob, 24, 35)

      // Head
      ctx.fillStyle = '#E8D4C4'
      ctx.beginPath()
      ctx.arc(x + 16, y + 10, 14, 0, Math.PI * 2)
      ctx.fill()

      // Hair
      ctx.fillStyle = '#3A2A1A'
      ctx.beginPath()
      ctx.arc(x + 16, y + 6, 12, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(x + 4, y + 4, 24, 8)

      // Eyes
      ctx.fillStyle = COLORS.player
      ctx.fillRect(x + 10, y + 10, 3, 3)
      ctx.fillRect(x + 19, y + 10, 3, 3)

      // Legs
      const legAnim = walking ? Math.sin(frame * 0.3) * 4 : 0
      ctx.fillStyle = '#2A2A2A'
      ctx.fillRect(x + 8, y + 53 + legAnim, 7, 17)
      ctx.fillRect(x + 17, y + 53 - legAnim, 7, 17)

      ctx.restore()
    }

    animationId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationId)
  }, [gameState, currentRoom, playerX, facingRight, time, getTimeOfDay])

  // Handle clicks for doors and entering
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState === 'opening') {
      setGameState('playing')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check door clicks
    const room = ROOMS[currentRoom]
    for (const door of room.doors) {
      if (x >= door.x - 3 && x <= door.x + 46 && y >= 130 && y <= 223) {
        setCurrentRoom(door.targetRoom)
        // Position near entry door
        const targetRoom = ROOMS[door.targetRoom]
        const entryDoor = targetRoom.doors.find(d => d.targetRoom === currentRoom)
        if (entryDoor) setPlayerX(entryDoor.x + 20)
        break
      }
    }
  }

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
            <p className="text-foreground-muted text-sm">Current Time</p>
            <p className="font-bold text-foreground">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="heading-editorial text-5xl md:text-6xl mb-2">The Cozy House</h1>
          <p className="font-subtitle text-foreground-muted text-lg">
            A place to call home
          </p>
        </div>

        <div
          className="pixel-card p-2 cursor-pointer relative"
          onClick={handleCanvasClick}
        >
          <canvas
            ref={canvasRef}
            width={600}
            height={300}
            className="block max-w-full"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Opening Overlay */}
          {gameState === 'opening' && (
            <div className="absolute inset-2 bg-transparent flex flex-col items-center justify-end pb-8">
              <button className="btn-primary">
                <DoorOpen size={16} />
                Enter House
              </button>
              <p className="text-white/70 text-sm mt-3">
                Click anywhere to enter
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        {gameState === 'playing' && (
          <div className="mt-6 text-center max-w-md">
            <p className="text-foreground-muted text-sm">
              Use arrow keys or A/D to walk. Click doors to explore rooms.
            </p>
          </div>
        )}
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
