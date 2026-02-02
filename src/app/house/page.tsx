'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// Room types
type RoomId = 'main' | 'ethan' | 'elijah' | 'kitchen'

interface Door {
  x: number
  width: number
  targetRoom: RoomId
  label: string
}

interface Furniture {
  type: 'sofa' | 'tv' | 'table' | 'lamp' | 'bed' | 'desk' | 'computer' | 'bookshelf' | 'window' | 'poster' | 'trash' | 'fridge' | 'stove' | 'counter' | 'plant' | 'rug' | 'bird_stand'
  x: number
  y: number
  width: number
  height: number
  flipped?: boolean
}

interface Room {
  id: RoomId
  name: string
  backgroundColor: string
  floorColor: string
  wallColor: string
  doors: Door[]
  furniture: Furniture[]
}

// Rain drop for opening scene
interface RainDrop {
  x: number
  y: number
  speed: number
  length: number
}

// Cloud for opening scene
interface Cloud {
  x: number
  y: number
  width: number
  speed: number
}

export default function HousePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'opening' | 'playing'>('opening')
  const [currentRoom, setCurrentRoom] = useState<RoomId>('main')
  const [playerX, setPlayerX] = useState(400)
  const [isWalking, setIsWalking] = useState(false)
  const [facingRight, setFacingRight] = useState(true)
  const [rainDrops, setRainDrops] = useState<RainDrop[]>([])
  const [clouds, setClouds] = useState<Cloud[]>([])
  const [hoverDoor, setHoverDoor] = useState<Door | null>(null)
  const [time, setTime] = useState(() => new Date())
  const [mounted, setMounted] = useState(false)

  const keysPressed = useRef<Set<string>>(new Set())
  const animationFrame = useRef(0)

  // Make sure component is mounted before rendering canvas
  useEffect(() => {
    setMounted(true)
  }, [])

  // Room definitions - memoized to prevent infinite re-renders
  const rooms: Record<RoomId, Room> = useMemo(() => ({
    main: {
      id: 'main',
      name: 'Living Room',
      backgroundColor: '#FAFAFA',
      floorColor: '#D4C4B0',
      wallColor: '#E8E0D8',
      doors: [
        { x: 100, width: 60, targetRoom: 'ethan', label: "Ethan's Room" },
        { x: 300, width: 60, targetRoom: 'kitchen', label: 'Kitchen' },
        { x: 640, width: 60, targetRoom: 'elijah', label: "Elijah's Room" },
      ],
      furniture: [
        { type: 'window', x: 200, y: 80, width: 100, height: 80 },
        { type: 'window', x: 500, y: 80, width: 100, height: 80 },
        { type: 'sofa', x: 350, y: 280, width: 120, height: 60 },
        { type: 'tv', x: 380, y: 180, width: 60, height: 50 },
        { type: 'lamp', x: 280, y: 240, width: 30, height: 80 },
        { type: 'lamp', x: 490, y: 240, width: 30, height: 80 },
        { type: 'rug', x: 320, y: 340, width: 160, height: 40 },
        { type: 'plant', x: 700, y: 260, width: 40, height: 60 },
      ]
    },
    ethan: {
      id: 'ethan',
      name: "Ethan's Room",
      backgroundColor: '#F0EDE8',
      floorColor: '#C0B8A8',
      wallColor: '#D8D0C8',
      doors: [
        { x: 640, width: 60, targetRoom: 'main', label: 'Living Room' },
      ],
      furniture: [
        { type: 'window', x: 300, y: 80, width: 80, height: 70 },
        { type: 'bed', x: 80, y: 260, width: 120, height: 80 },
        { type: 'desk', x: 500, y: 240, width: 100, height: 60 },
        { type: 'computer', x: 520, y: 200, width: 60, height: 50 },
        { type: 'trash', x: 450, y: 320, width: 30, height: 30 },
        { type: 'trash', x: 250, y: 340, width: 25, height: 25 },
        { type: 'trash', x: 180, y: 350, width: 28, height: 28 },
        { type: 'poster', x: 150, y: 100, width: 50, height: 70 },
        { type: 'poster', x: 420, y: 90, width: 60, height: 80 },
      ]
    },
    elijah: {
      id: 'elijah',
      name: "Elijah's Room",
      backgroundColor: '#F8F8F8',
      floorColor: '#E0DCD4',
      wallColor: '#F0EDE8',
      doors: [
        { x: 100, width: 60, targetRoom: 'main', label: 'Living Room' },
      ],
      furniture: [
        { type: 'window', x: 350, y: 80, width: 120, height: 90 },
        { type: 'bed', x: 550, y: 260, width: 120, height: 80 },
        { type: 'desk', x: 200, y: 250, width: 90, height: 50 },
        { type: 'bookshelf', x: 550, y: 140, width: 80, height: 120 },
        { type: 'bird_stand', x: 420, y: 220, width: 40, height: 100 },
        { type: 'plant', x: 180, y: 270, width: 35, height: 50 },
      ]
    },
    kitchen: {
      id: 'kitchen',
      name: 'Kitchen',
      backgroundColor: '#FAFAF8',
      floorColor: '#D8D4CC',
      wallColor: '#E8E4DC',
      doors: [
        { x: 640, width: 60, targetRoom: 'main', label: 'Living Room' },
      ],
      furniture: [
        { type: 'window', x: 200, y: 80, width: 100, height: 80 },
        { type: 'fridge', x: 80, y: 200, width: 60, height: 120 },
        { type: 'counter', x: 160, y: 260, width: 200, height: 60 },
        { type: 'stove', x: 250, y: 220, width: 70, height: 50 },
        { type: 'table', x: 450, y: 280, width: 100, height: 60 },
      ]
    }
  }), [])

  // Initialize rain and clouds for opening scene
  useEffect(() => {
    if (gameState === 'opening') {
      const drops: RainDrop[] = []
      for (let i = 0; i < 200; i++) {
        drops.push({
          x: Math.random() * 800,
          y: Math.random() * 500,
          speed: 4 + Math.random() * 4,
          length: 10 + Math.random() * 15
        })
      }
      setRainDrops(drops)

      const cloudList: Cloud[] = []
      for (let i = 0; i < 5; i++) {
        cloudList.push({
          x: Math.random() * 1000 - 200,
          y: 30 + Math.random() * 80,
          width: 100 + Math.random() * 100,
          speed: 0.2 + Math.random() * 0.3
        })
      }
      setClouds(cloudList)
    }
  }, [gameState])

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Get time of day for lighting
  const getTimeOfDay = useCallback(() => {
    const hour = time.getHours()
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 20) return 'evening'
    return 'night'
  }, [time])

  // Handle keyboard input
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

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return

    const gameLoop = () => {
      // Movement
      const speed = 4
      let moving = false

      if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) {
        setPlayerX(prev => Math.max(40, prev - speed))
        moving = true
      }
      if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) {
        setPlayerX(prev => Math.min(760, prev + speed))
        moving = true
      }

      setIsWalking(moving)
      animationFrame.current = requestAnimationFrame(gameLoop)
    }

    animationFrame.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animationFrame.current)
  }, [gameState])

  // Draw opening scene
  const drawOpeningScene = useCallback((ctx: CanvasRenderingContext2D) => {
    // Dark stormy sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 500)
    skyGradient.addColorStop(0, '#2A2A2A')
    skyGradient.addColorStop(0.5, '#3A3A3A')
    skyGradient.addColorStop(1, '#4A4A4A')
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, 800, 500)

    // Draw clouds
    ctx.fillStyle = '#3D3D3D'
    clouds.forEach(cloud => {
      ctx.beginPath()
      ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, 30, 0, 0, Math.PI * 2)
      ctx.ellipse(cloud.x - 30, cloud.y + 10, cloud.width / 3, 25, 0, 0, Math.PI * 2)
      ctx.ellipse(cloud.x + 40, cloud.y + 5, cloud.width / 3, 28, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // Hill
    ctx.fillStyle = '#2D2D2D'
    ctx.beginPath()
    ctx.moveTo(0, 500)
    ctx.quadraticCurveTo(400, 280, 800, 500)
    ctx.fill()

    // Grass texture on hill
    ctx.strokeStyle = '#252525'
    ctx.lineWidth = 1
    for (let i = 0; i < 100; i++) {
      const x = 100 + Math.random() * 600
      const baseY = 350 + (Math.abs(x - 400) / 400) * 100
      ctx.beginPath()
      ctx.moveTo(x, baseY + 20)
      ctx.lineTo(x + Math.sin(Date.now() / 500 + i) * 3, baseY + 5)
      ctx.stroke()
    }

    // House on hill
    const houseX = 320
    const houseY = 280

    // House body
    ctx.fillStyle = '#1A1A1A'
    ctx.fillRect(houseX, houseY, 160, 100)

    // Roof
    ctx.beginPath()
    ctx.moveTo(houseX - 20, houseY)
    ctx.lineTo(houseX + 80, houseY - 60)
    ctx.lineTo(houseX + 180, houseY)
    ctx.closePath()
    ctx.fill()

    // Windows with warm light
    ctx.fillStyle = '#FFE4B5'
    ctx.fillRect(houseX + 20, houseY + 20, 30, 30)
    ctx.fillRect(houseX + 110, houseY + 20, 30, 30)

    // Window glow effect
    ctx.shadowColor = '#FFE4B5'
    ctx.shadowBlur = 20
    ctx.fillRect(houseX + 20, houseY + 20, 30, 30)
    ctx.fillRect(houseX + 110, houseY + 20, 30, 30)
    ctx.shadowBlur = 0

    // Door
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(houseX + 60, houseY + 50, 40, 50)

    // Chimney
    ctx.fillStyle = '#1A1A1A'
    ctx.fillRect(houseX + 120, houseY - 40, 25, 50)

    // Rain
    ctx.strokeStyle = '#6A6A6A'
    ctx.lineWidth = 1
    rainDrops.forEach(drop => {
      ctx.beginPath()
      ctx.moveTo(drop.x, drop.y)
      ctx.lineTo(drop.x - 2, drop.y + drop.length)
      ctx.stroke()
    })

    // Title
    ctx.fillStyle = '#FAFAFA'
    ctx.font = '48px "Bebas Neue", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('THE COZY HOUSE', 400, 80)

    // Subtitle
    ctx.font = 'italic 18px "Playfair Display", serif'
    ctx.fillStyle = '#AAAAAA'
    ctx.fillText('A place to call home', 400, 110)

    // Click to enter
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7
    ctx.fillStyle = `rgba(250, 250, 250, ${pulse})`
    ctx.font = '16px Inter, sans-serif'
    ctx.fillText('Click anywhere to enter', 400, 460)
  }, [clouds, rainDrops])

  // Draw room
  const drawRoom = useCallback((ctx: CanvasRenderingContext2D, room: Room) => {
    const timeOfDay = getTimeOfDay()
    let lightOverlay = 'rgba(0,0,0,0)'

    if (timeOfDay === 'evening') lightOverlay = 'rgba(255, 180, 100, 0.1)'
    if (timeOfDay === 'night') lightOverlay = 'rgba(30, 30, 60, 0.3)'

    // Wall
    ctx.fillStyle = room.wallColor
    ctx.fillRect(0, 0, 800, 400)

    // Floor
    ctx.fillStyle = room.floorColor
    ctx.fillRect(0, 350, 800, 150)

    // Floor boards
    ctx.strokeStyle = '#C0B8A8'
    ctx.lineWidth = 1
    for (let i = 0; i < 10; i++) {
      ctx.beginPath()
      ctx.moveTo(i * 80, 350)
      ctx.lineTo(i * 80, 500)
      ctx.stroke()
    }

    // Draw furniture
    room.furniture.forEach(f => drawFurniture(ctx, f, timeOfDay))

    // Draw doors
    room.doors.forEach(door => {
      const isHovered = hoverDoor?.targetRoom === door.targetRoom

      // Door frame
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(door.x - 5, 200, door.width + 10, 155)

      // Door
      ctx.fillStyle = isHovered ? '#3A3A3A' : '#2A2A2A'
      ctx.fillRect(door.x, 205, door.width, 145)

      // Door handle
      ctx.fillStyle = '#8C8C8C'
      ctx.beginPath()
      ctx.arc(door.x + door.width - 12, 280, 4, 0, Math.PI * 2)
      ctx.fill()

      // Label above door
      ctx.fillStyle = '#666666'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(door.label, door.x + door.width / 2, 190)
    })

    // Draw player (Rene)
    drawPlayer(ctx, playerX, 280, facingRight, isWalking)

    // Time overlay
    ctx.fillStyle = lightOverlay
    ctx.fillRect(0, 0, 800, 500)

    // Room name
    ctx.fillStyle = '#1A1A1A'
    ctx.font = '24px "Bebas Neue", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(room.name.toUpperCase(), 20, 40)

    // Time display
    ctx.font = '14px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 780, 40)

    // Controls hint
    ctx.fillStyle = '#8C8C8C'
    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Arrow keys or A/D to move • Click doors to enter rooms', 400, 485)
  }, [hoverDoor, playerX, facingRight, isWalking, time, getTimeOfDay])

  // Draw furniture
  const drawFurniture = (ctx: CanvasRenderingContext2D, f: Furniture, timeOfDay: string) => {
    ctx.fillStyle = '#1A1A1A'

    switch (f.type) {
      case 'sofa':
        // Sofa base
        ctx.fillStyle = '#3A3A3A'
        ctx.fillRect(f.x, f.y + 20, f.width, f.height - 20)
        // Back
        ctx.fillRect(f.x, f.y, f.width, 25)
        // Arms
        ctx.fillRect(f.x - 10, f.y + 10, 15, f.height - 10)
        ctx.fillRect(f.x + f.width - 5, f.y + 10, 15, f.height - 10)
        // Cushions
        ctx.fillStyle = '#4A4A4A'
        ctx.fillRect(f.x + 10, f.y + 25, 45, 30)
        ctx.fillRect(f.x + 65, f.y + 25, 45, 30)
        break

      case 'tv':
        // TV stand
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(f.x - 10, f.y + f.height, f.width + 20, 20)
        // TV
        ctx.fillStyle = '#1A1A1A'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        // Screen
        ctx.fillStyle = '#3A3A3A'
        ctx.fillRect(f.x + 3, f.y + 3, f.width - 6, f.height - 10)
        break

      case 'lamp':
        // Base
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(f.x + 10, f.y + f.height - 10, 10, 10)
        // Pole
        ctx.fillRect(f.x + 13, f.y + 20, 4, f.height - 30)
        // Shade
        ctx.fillStyle = '#E8E0D8'
        ctx.beginPath()
        ctx.moveTo(f.x, f.y + 20)
        ctx.lineTo(f.x + f.width, f.y + 20)
        ctx.lineTo(f.x + f.width - 5, f.y)
        ctx.lineTo(f.x + 5, f.y)
        ctx.closePath()
        ctx.fill()
        // Light glow at night/evening
        if (timeOfDay === 'night' || timeOfDay === 'evening') {
          ctx.fillStyle = 'rgba(255, 230, 180, 0.3)'
          ctx.beginPath()
          ctx.ellipse(f.x + 15, f.y + 40, 30, 50, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        break

      case 'window':
        // Window frame
        ctx.fillStyle = '#D8D0C8'
        ctx.fillRect(f.x - 5, f.y - 5, f.width + 10, f.height + 10)
        // Window glass - shows sky based on time
        if (timeOfDay === 'night') {
          ctx.fillStyle = '#1A1A2A'
        } else if (timeOfDay === 'evening') {
          ctx.fillStyle = '#FFB366'
        } else if (timeOfDay === 'morning') {
          ctx.fillStyle = '#87CEEB'
        } else {
          ctx.fillStyle = '#ADD8E6'
        }
        ctx.fillRect(f.x, f.y, f.width, f.height)
        // Window panes
        ctx.strokeStyle = '#8C8C8C'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(f.x + f.width / 2, f.y)
        ctx.lineTo(f.x + f.width / 2, f.y + f.height)
        ctx.moveTo(f.x, f.y + f.height / 2)
        ctx.lineTo(f.x + f.width, f.y + f.height / 2)
        ctx.stroke()
        break

      case 'bed':
        // Bed frame
        ctx.fillStyle = '#3A3A3A'
        ctx.fillRect(f.x, f.y + 30, f.width, f.height - 30)
        // Headboard
        ctx.fillRect(f.x, f.y, 20, f.height)
        // Pillow
        ctx.fillStyle = '#E8E0D8'
        ctx.fillRect(f.x + 25, f.y + 35, 40, 25)
        // Blanket
        ctx.fillStyle = '#4A4A4A'
        ctx.fillRect(f.x + 25, f.y + 55, f.width - 30, f.height - 60)
        break

      case 'desk':
        // Desktop
        ctx.fillStyle = '#4A4A4A'
        ctx.fillRect(f.x, f.y, f.width, 10)
        // Legs
        ctx.fillRect(f.x + 5, f.y + 10, 8, f.height - 10)
        ctx.fillRect(f.x + f.width - 13, f.y + 10, 8, f.height - 10)
        break

      case 'computer':
        // Monitor
        ctx.fillStyle = '#1A1A1A'
        ctx.fillRect(f.x, f.y, f.width, f.height - 10)
        // Screen
        ctx.fillStyle = '#2A3A2A'
        ctx.fillRect(f.x + 3, f.y + 3, f.width - 6, f.height - 16)
        // Stand
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(f.x + f.width / 2 - 5, f.y + f.height - 10, 10, 10)
        break

      case 'trash':
        // Trash/mess
        ctx.fillStyle = '#5A5A5A'
        ctx.beginPath()
        ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 3, 0, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'poster':
        ctx.fillStyle = '#4A4A4A'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        ctx.fillStyle = '#3A3A3A'
        ctx.fillRect(f.x + 5, f.y + 5, f.width - 10, f.height - 10)
        break

      case 'bookshelf':
        ctx.fillStyle = '#3A3A3A'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        // Shelves
        for (let i = 1; i < 4; i++) {
          ctx.fillStyle = '#2A2A2A'
          ctx.fillRect(f.x, f.y + (i * f.height / 4), f.width, 5)
          // Books
          for (let j = 0; j < 5; j++) {
            ctx.fillStyle = `hsl(0, 0%, ${20 + j * 10}%)`
            ctx.fillRect(f.x + 5 + j * 14, f.y + (i * f.height / 4) - 25, 12, 25)
          }
        }
        break

      case 'bird_stand':
        // Pole
        ctx.fillStyle = '#5A5A5A'
        ctx.fillRect(f.x + f.width / 2 - 3, f.y + 30, 6, f.height - 30)
        // Base
        ctx.fillRect(f.x, f.y + f.height - 10, f.width, 10)
        // Perch
        ctx.fillRect(f.x - 10, f.y + 30, f.width + 20, 5)
        break

      case 'fridge':
        ctx.fillStyle = '#E8E0D8'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        // Door line
        ctx.strokeStyle = '#8C8C8C'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(f.x, f.y + f.height * 0.4)
        ctx.lineTo(f.x + f.width, f.y + f.height * 0.4)
        ctx.stroke()
        // Handles
        ctx.fillStyle = '#666666'
        ctx.fillRect(f.x + f.width - 10, f.y + 20, 5, 20)
        ctx.fillRect(f.x + f.width - 10, f.y + f.height * 0.5, 5, 20)
        break

      case 'stove':
        ctx.fillStyle = '#2A2A2A'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        // Burners
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath()
        ctx.arc(f.x + 20, f.y + 15, 10, 0, Math.PI * 2)
        ctx.arc(f.x + 50, f.y + 15, 10, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'counter':
        ctx.fillStyle = '#D8D0C8'
        ctx.fillRect(f.x, f.y, f.width, 15)
        // Cabinets below
        ctx.fillStyle = '#4A4A4A'
        ctx.fillRect(f.x, f.y + 15, f.width, f.height - 15)
        // Cabinet doors
        ctx.strokeStyle = '#3A3A3A'
        ctx.lineWidth = 2
        for (let i = 0; i < 3; i++) {
          ctx.strokeRect(f.x + 5 + i * 65, f.y + 20, 60, f.height - 30)
        }
        break

      case 'table':
        ctx.fillStyle = '#5A5A4A'
        ctx.fillRect(f.x, f.y, f.width, 10)
        // Legs
        ctx.fillRect(f.x + 10, f.y + 10, 8, f.height - 10)
        ctx.fillRect(f.x + f.width - 18, f.y + 10, 8, f.height - 10)
        break

      case 'plant':
        // Pot
        ctx.fillStyle = '#8B4513'
        ctx.fillRect(f.x + 5, f.y + f.height - 20, f.width - 10, 20)
        // Plant
        ctx.fillStyle = '#2D5A2D'
        ctx.beginPath()
        ctx.ellipse(f.x + f.width / 2, f.y + 15, f.width / 2, f.height / 2.5, 0, 0, Math.PI * 2)
        ctx.fill()
        break

      case 'rug':
        ctx.fillStyle = '#8B7355'
        ctx.fillRect(f.x, f.y, f.width, f.height)
        ctx.strokeStyle = '#7A6245'
        ctx.lineWidth = 2
        ctx.strokeRect(f.x + 5, f.y + 5, f.width - 10, f.height - 10)
        break
    }
  }

  // Draw player (Rene)
  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, walking: boolean) => {
    ctx.save()

    if (!facingRight) {
      ctx.translate(x + 20, 0)
      ctx.scale(-1, 1)
      ctx.translate(-x - 20, 0)
    }

    // Animation offset for walking
    const walkOffset = walking ? Math.sin(Date.now() / 100) * 3 : 0

    // Body
    ctx.fillStyle = '#4A4A4A'
    ctx.fillRect(x + 5, y + 30 + walkOffset, 30, 45)

    // Head
    ctx.fillStyle = '#E8D4C4'
    ctx.beginPath()
    ctx.arc(x + 20, y + 15, 18, 0, Math.PI * 2)
    ctx.fill()

    // Hair
    ctx.fillStyle = '#3A2A1A'
    ctx.beginPath()
    ctx.arc(x + 20, y + 10, 16, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(x + 4, y + 8, 32, 12)

    // Eyes
    ctx.fillStyle = '#1A1A1A'
    ctx.beginPath()
    ctx.arc(x + 14, y + 15, 2, 0, Math.PI * 2)
    ctx.arc(x + 26, y + 15, 2, 0, Math.PI * 2)
    ctx.fill()

    // Legs
    ctx.fillStyle = '#2A2A2A'
    const leftLegOffset = walking ? Math.sin(Date.now() / 100) * 5 : 0
    const rightLegOffset = walking ? -Math.sin(Date.now() / 100) * 5 : 0
    ctx.fillRect(x + 8, y + 75 + leftLegOffset, 10, 25)
    ctx.fillRect(x + 22, y + 75 + rightLegOffset, 10, 25)

    ctx.restore()
  }

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameId: number

    const render = () => {
      ctx.clearRect(0, 0, 800, 500)

      if (gameState === 'opening') {
        drawOpeningScene(ctx)

        // Update rain
        setRainDrops(prev => prev.map(drop => ({
          ...drop,
          x: drop.x - 1,
          y: drop.y + drop.speed > 500 ? 0 : drop.y + drop.speed,
        })))

        // Update clouds
        setClouds(prev => prev.map(cloud => ({
          ...cloud,
          x: cloud.x + cloud.speed > 900 ? -200 : cloud.x + cloud.speed
        })))
      } else {
        drawRoom(ctx, rooms[currentRoom])
      }

      frameId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(frameId)
  }, [gameState, currentRoom, drawOpeningScene, drawRoom, rooms])

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (gameState === 'opening') {
      setGameState('playing')
      return
    }

    // Check door clicks
    const room = rooms[currentRoom]
    for (const door of room.doors) {
      if (x >= door.x && x <= door.x + door.width && y >= 200 && y <= 350) {
        setCurrentRoom(door.targetRoom)
        // Position player near the door they came from
        const targetRoom = rooms[door.targetRoom]
        const entryDoor = targetRoom.doors.find(d => d.targetRoom === currentRoom)
        if (entryDoor) {
          setPlayerX(entryDoor.x + entryDoor.width / 2)
        }
        break
      }
    }
  }

  // Handle mouse move for door hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const room = rooms[currentRoom]
    let foundDoor: Door | null = null

    for (const door of room.doors) {
      if (x >= door.x && x <= door.x + door.width && y >= 200 && y <= 350) {
        foundDoor = door
        break
      }
    }

    setHoverDoor(foundDoor)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-foreground text-xl">Loading The Cozy House...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        className="pixel-card cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />

      {gameState === 'playing' && (
        <div className="mt-4 text-center">
          <p className="text-foreground-muted text-sm">
            Explore the house! More features coming soon...
          </p>
        </div>
      )}
    </div>
  )
}
