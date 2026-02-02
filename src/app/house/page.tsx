'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, DoorOpen } from 'lucide-react'

// STRICTLY monochrome palette - matching The Wire exactly
const COLORS = {
  white: '#FAFAFA',
  lightGray: '#E0E0E0',
  mediumGray: '#8C8C8C',
  darkGray: '#4A4A4A',
  black: '#1A1A1A',
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
    doors: [{ x: 460, targetRoom: 'main', label: 'Back' }],
  },
  elijah: {
    id: 'elijah',
    name: "Elijah's Room",
    doors: [{ x: 80, targetRoom: 'main', label: 'Back' }],
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    doors: [{ x: 460, targetRoom: 'main', label: 'Back' }],
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

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const getTimeOfDay = useCallback(() => {
    const hour = time.getHours()
    if (hour >= 20 || hour < 6) return 'night'
    return 'day'
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

  // Render loop
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
      ctx.fillStyle = COLORS.white
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
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(0, 0, 600, 300)

      // Moving clouds - simple ellipses
      ctx.fillStyle = COLORS.mediumGray
      for (let i = 0; i < 3; i++) {
        const cloudX = ((frame * 0.2 + i * 250) % 900) - 150
        ctx.beginPath()
        ctx.ellipse(cloudX, 50 + i * 20, 80, 25, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Hill - simple curve
      ctx.fillStyle = COLORS.black
      ctx.beginPath()
      ctx.moveTo(0, 300)
      ctx.quadraticCurveTo(300, 180, 600, 300)
      ctx.fill()

      // House silhouette
      const hx = 240, hy = 185

      // House body
      ctx.fillStyle = COLORS.black
      ctx.fillRect(hx, hy, 120, 70)

      // Roof
      ctx.beginPath()
      ctx.moveTo(hx - 10, hy)
      ctx.lineTo(hx + 60, hy - 40)
      ctx.lineTo(hx + 130, hy)
      ctx.closePath()
      ctx.fill()

      // Windows - glowing white
      ctx.fillStyle = COLORS.white
      ctx.fillRect(hx + 20, hy + 15, 20, 20)
      ctx.fillRect(hx + 80, hy + 15, 20, 20)

      // Window glow
      ctx.shadowColor = COLORS.white
      ctx.shadowBlur = 10
      ctx.fillRect(hx + 20, hy + 15, 20, 20)
      ctx.fillRect(hx + 80, hy + 15, 20, 20)
      ctx.shadowBlur = 0

      // Door
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(hx + 48, hy + 35, 24, 35)

      // Chimney
      ctx.fillStyle = COLORS.black
      ctx.fillRect(hx + 90, hy - 25, 15, 30)

      // Rain - simple lines
      ctx.strokeStyle = COLORS.mediumGray
      ctx.lineWidth = 1
      for (let i = 0; i < 60; i++) {
        const rx = (i * 10 + frame * 2) % 620 - 10
        const ry = (i * 13 + frame * 4) % 320 - 20
        ctx.beginPath()
        ctx.moveTo(rx, ry)
        ctx.lineTo(rx - 1, ry + 8)
        ctx.stroke()
      }

      // Grass strokes
      ctx.strokeStyle = COLORS.darkGray
      ctx.lineWidth = 1
      for (let i = 0; i < 30; i++) {
        const gx = 80 + i * 15
        const gy = 230 + Math.abs(gx - 300) / 6
        const sway = Math.sin(frame * 0.03 + i) * 2
        ctx.beginPath()
        ctx.moveTo(gx, gy + 20)
        ctx.lineTo(gx + sway, gy + 8)
        ctx.stroke()
      }
    }

    const drawRoom = (ctx: CanvasRenderingContext2D, frame: number) => {
      const room = ROOMS[currentRoom]
      const isNight = getTimeOfDay() === 'night'

      // Wall
      ctx.fillStyle = isNight ? COLORS.darkGray : COLORS.lightGray
      ctx.fillRect(0, 0, 600, 220)

      // Floor
      ctx.fillStyle = COLORS.lightGray
      ctx.fillRect(0, 220, 600, 80)

      // Floor line
      ctx.strokeStyle = COLORS.black
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, 220)
      ctx.lineTo(600, 220)
      ctx.stroke()

      // Floor texture - dashed lines like game
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = COLORS.mediumGray
      ctx.lineWidth = 1
      for (let y = 240; y < 300; y += 20) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(600, y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Draw room content
      if (currentRoom === 'main') drawMainRoom(ctx, isNight)
      else if (currentRoom === 'ethan') drawEthanRoom(ctx, isNight)
      else if (currentRoom === 'elijah') drawElijahRoom(ctx, isNight)
      else drawKitchen(ctx, isNight)

      // Draw doors
      room.doors.forEach(door => {
        // Door frame
        ctx.fillStyle = COLORS.black
        ctx.fillRect(door.x - 2, 135, 44, 88)
        // Door
        ctx.fillStyle = COLORS.darkGray
        ctx.fillRect(door.x, 137, 40, 83)
        // Handle
        ctx.fillStyle = COLORS.mediumGray
        ctx.beginPath()
        ctx.arc(door.x + 32, 178, 3, 0, Math.PI * 2)
        ctx.fill()
        // Label
        ctx.fillStyle = COLORS.mediumGray
        ctx.font = '10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(door.label, door.x + 20, 128)
      })

      // Draw player
      drawPlayer(ctx, playerX, frame)

      // Room name
      ctx.fillStyle = COLORS.black
      ctx.font = 'bold 14px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(room.name.toUpperCase(), 15, 25)

      // Time
      ctx.textAlign = 'right'
      ctx.fillText(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 585, 25)

      // Night overlay
      if (isNight) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.fillRect(0, 0, 600, 300)
      }
    }

    const drawWindow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isNight: boolean) => {
      // Frame
      ctx.fillStyle = COLORS.mediumGray
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
      // Glass
      ctx.fillStyle = isNight ? COLORS.black : COLORS.darkGray
      ctx.fillRect(x, y, w, h)
      // Panes
      ctx.strokeStyle = COLORS.mediumGray
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w / 2, y + h)
      ctx.moveTo(x, y + h / 2)
      ctx.lineTo(x + w, y + h / 2)
      ctx.stroke()
    }

    const drawMainRoom = (ctx: CanvasRenderingContext2D, isNight: boolean) => {
      // Windows
      drawWindow(ctx, 160, 55, 60, 50, isNight)
      drawWindow(ctx, 380, 55, 60, 50, isNight)

      // TV
      ctx.fillStyle = COLORS.black
      ctx.fillRect(280, 150, 40, 30)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(283, 153, 34, 22)
      // TV stand
      ctx.fillStyle = COLORS.black
      ctx.fillRect(270, 180, 60, 10)

      // Sofa
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(255, 195, 90, 25)
      ctx.fillRect(255, 185, 90, 12)
      // Arms
      ctx.fillRect(250, 188, 10, 32)
      ctx.fillRect(340, 188, 10, 32)

      // Lamps
      const drawLamp = (lx: number) => {
        ctx.fillStyle = COLORS.black
        ctx.fillRect(lx + 6, 195, 3, 25)
        ctx.fillStyle = COLORS.lightGray
        ctx.beginPath()
        ctx.moveTo(lx, 195)
        ctx.lineTo(lx + 15, 195)
        ctx.lineTo(lx + 12, 180)
        ctx.lineTo(lx + 3, 180)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = COLORS.mediumGray
        ctx.lineWidth = 1
        ctx.stroke()
        // Glow at night
        if (isNight) {
          ctx.fillStyle = 'rgba(250, 250, 250, 0.15)'
          ctx.beginPath()
          ctx.ellipse(lx + 7, 205, 20, 30, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      drawLamp(200)
      drawLamp(385)

      // Plant silhouette
      ctx.fillStyle = COLORS.black
      ctx.fillRect(545, 200, 20, 20)
      ctx.beginPath()
      ctx.ellipse(555, 188, 15, 20, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawEthanRoom = (ctx: CanvasRenderingContext2D, isNight: boolean) => {
      // Taped window
      ctx.fillStyle = COLORS.mediumGray
      ctx.fillRect(217, 52, 66, 56)
      ctx.fillStyle = COLORS.black
      ctx.fillRect(220, 55, 60, 50)
      // Tape X
      ctx.strokeStyle = COLORS.lightGray
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(220, 55)
      ctx.lineTo(280, 105)
      ctx.moveTo(280, 55)
      ctx.lineTo(220, 105)
      ctx.stroke()

      // Messy bed
      ctx.fillStyle = COLORS.black
      ctx.fillRect(60, 185, 80, 35)
      ctx.fillRect(60, 170, 12, 50)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(72, 190, 65, 25)

      // Computer desk
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(350, 180, 60, 6)
      ctx.fillRect(355, 186, 6, 34)
      ctx.fillRect(398, 186, 6, 34)
      // Monitor
      ctx.fillStyle = COLORS.black
      ctx.fillRect(360, 150, 35, 30)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(363, 153, 29, 22)

      // Trash - circles
      ctx.fillStyle = COLORS.darkGray
      for (const [tx, ty] of [[180, 210], [220, 208], [300, 212], [140, 205]]) {
        ctx.beginPath()
        ctx.ellipse(tx, ty, 10, 6, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Posters
      ctx.fillStyle = COLORS.black
      ctx.fillRect(100, 65, 30, 45)
      ctx.fillRect(320, 60, 40, 55)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(103, 68, 24, 39)
      ctx.fillRect(323, 63, 34, 49)
    }

    const drawElijahRoom = (ctx: CanvasRenderingContext2D, isNight: boolean) => {
      // Nice window
      drawWindow(ctx, 250, 50, 80, 60, isNight)

      // Neat bed
      ctx.fillStyle = COLORS.black
      ctx.fillRect(450, 185, 80, 35)
      ctx.fillRect(450, 170, 12, 50)
      ctx.fillStyle = COLORS.lightGray
      ctx.fillRect(462, 190, 30, 15)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(462, 195, 65, 20)

      // Desk
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(160, 185, 60, 6)
      ctx.fillRect(165, 191, 6, 29)
      ctx.fillRect(208, 191, 6, 29)
      // Laptop
      ctx.fillStyle = COLORS.black
      ctx.fillRect(170, 165, 35, 22)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(173, 168, 29, 16)

      // Bookshelf
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(450, 75, 55, 80)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = COLORS.black
        ctx.fillRect(450, 95 + i * 22, 55, 3)
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = j % 2 === 0 ? COLORS.black : COLORS.mediumGray
          ctx.fillRect(453 + j * 12, 77 + i * 22, 9, 18)
        }
      }

      // Bird stand
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(378, 175, 4, 45)
      ctx.fillRect(365, 218, 30, 4)
      ctx.fillRect(362, 175, 36, 3)

      // Plant
      ctx.fillStyle = COLORS.black
      ctx.fillRect(145, 202, 18, 18)
      ctx.beginPath()
      ctx.ellipse(154, 192, 12, 16, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawKitchen = (ctx: CanvasRenderingContext2D, isNight: boolean) => {
      // Window
      drawWindow(ctx, 160, 55, 70, 55, isNight)

      // Fridge
      ctx.fillStyle = COLORS.lightGray
      ctx.fillRect(60, 130, 45, 90)
      ctx.strokeStyle = COLORS.mediumGray
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(60, 165)
      ctx.lineTo(105, 165)
      ctx.stroke()
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(95, 145, 4, 12)
      ctx.fillRect(95, 180, 4, 12)

      // Counter
      ctx.fillStyle = COLORS.lightGray
      ctx.fillRect(125, 180, 140, 10)
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(125, 190, 140, 30)

      // Stove
      ctx.fillStyle = COLORS.black
      ctx.fillRect(190, 155, 50, 28)
      ctx.fillStyle = COLORS.darkGray
      ctx.beginPath()
      ctx.arc(205, 168, 7, 0, Math.PI * 2)
      ctx.arc(230, 168, 7, 0, Math.PI * 2)
      ctx.fill()

      // Table
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(350, 190, 70, 6)
      ctx.fillRect(358, 196, 6, 24)
      ctx.fillRect(406, 196, 6, 24)
    }

    const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, frame: number) => {
      const y = 175
      ctx.save()
      if (!facingRight) {
        ctx.translate(x + 16, 0)
        ctx.scale(-1, 1)
        ctx.translate(-x - 16, 0)
      }

      const walking = keysPressed.current.size > 0
      const bob = walking ? Math.sin(frame * 0.3) * 2 : 0

      // Body
      ctx.fillStyle = COLORS.black
      ctx.fillRect(x + 6, y + 18 + bob, 20, 32)

      // Head
      ctx.fillStyle = COLORS.lightGray
      ctx.beginPath()
      ctx.arc(x + 16, y + 12, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = COLORS.black
      ctx.lineWidth = 2
      ctx.stroke()

      // Hair
      ctx.fillStyle = COLORS.black
      ctx.beginPath()
      ctx.arc(x + 16, y + 8, 10, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(x + 6, y + 6, 20, 6)

      // Eyes
      ctx.fillStyle = COLORS.black
      ctx.fillRect(x + 11, y + 12, 2, 2)
      ctx.fillRect(x + 19, y + 12, 2, 2)

      // Legs
      const legAnim = walking ? Math.sin(frame * 0.3) * 3 : 0
      ctx.fillStyle = COLORS.darkGray
      ctx.fillRect(x + 9, y + 50 + legAnim, 6, 15)
      ctx.fillRect(x + 17, y + 50 - legAnim, 6, 15)

      ctx.restore()
    }

    animationId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationId)
  }, [gameState, currentRoom, playerX, facingRight, time, getTimeOfDay])

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

    const room = ROOMS[currentRoom]
    for (const door of room.doors) {
      if (x >= door.x - 2 && x <= door.x + 44 && y >= 135 && y <= 223) {
        setCurrentRoom(door.targetRoom)
        const targetRoom = ROOMS[door.targetRoom]
        const entryDoor = targetRoom.doors.find(d => d.targetRoom === currentRoom)
        if (entryDoor) setPlayerX(entryDoor.x + 20)
        break
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

        {gameState === 'playing' && (
          <div className="mt-6 text-center max-w-md">
            <p className="text-foreground-muted text-sm">
              Arrow keys or A/D to walk. Click doors to explore.
            </p>
          </div>
        )}
      </main>

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
