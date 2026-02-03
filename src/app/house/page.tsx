'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import * as THREE from 'three'

export default function HousePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gameState, setGameState] = useState<'MENU' | 'PLAY'>('MENU')
  const [dialogue, setDialogue] = useState<{ name: string; text: string } | null>(null)
  const threeRef = useRef<any>(null)
  const keysRef = useRef<{ [key: string]: boolean }>({})

  useEffect(() => {
    if (!containerRef.current || threeRef.current) return

    // --- SETUP ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)
    scene.fog = new THREE.FogExp2(0x111111, 0.035)

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    camera.position.set(0, 8, 18)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.filter = 'grayscale(100%) contrast(120%) brightness(90%)'
    containerRef.current.appendChild(renderer.domElement)

    const clock = new THREE.Clock()

    // Real-time day/night check
    const currentHour = new Date().getHours()
    const isNight = (currentHour >= 18 || currentHour < 6)

    // Game objects
    const houseGroup = new THREE.Group()
    const roofGroup = new THREE.Group()

    // Character refs
    const rene = { mesh: null as THREE.Group | null, name: 'Rene' }
    const ethan = { mesh: null as THREE.Group | null, name: 'Ethan' }
    const eli = { mesh: null as THREE.Group | null, name: 'Eli' }

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Store refs
    threeRef.current = {
      scene, camera, renderer, roofGroup,
      rene, ethan, eli,
      gameState: 'MENU',
      cameraAngle: 0,
      cameraTarget: new THREE.Vector3(0, 0, 0)
    }

    // --- LIGHTING ---
    // Ambient
    const ambientLight = new THREE.AmbientLight(0x222233, 0.3)
    scene.add(ambientLight)

    // Hemisphere
    const hemiLight = new THREE.HemisphereLight(0x8888aa, 0x333344, 0.4)
    scene.add(hemiLight)

    // Main directional (moonlight/sunlight)
    const dirLight = new THREE.DirectionalLight(isNight ? 0x4466aa : 0xffffee, isNight ? 0.3 : 0.8)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 50
    dirLight.shadow.camera.left = -20
    dirLight.shadow.camera.right = 20
    dirLight.shadow.camera.top = 20
    dirLight.shadow.camera.bottom = -20
    scene.add(dirLight)

    // Room lights array for later reference
    const roomLights: THREE.PointLight[] = []

    // Lamp helper
    const createLamp = (x: number, y: number, z: number, color: number, intensity: number = 1.5) => {
      const light = new THREE.PointLight(color, isNight ? intensity : 0.2, 10)
      light.position.set(x, y, z)
      light.castShadow = true
      light.shadow.mapSize.width = 512
      light.shadow.mapSize.height = 512
      scene.add(light)
      roomLights.push(light)

      // Bulb mesh
      const bulbGeo = new THREE.SphereGeometry(0.15)
      const bulbMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isNight ? 1 : 0.3 })
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(x, y, z)
      scene.add(bulb)

      // Lamp shade
      const shadeGeo = new THREE.CylinderGeometry(0.3, 0.5, 0.3, 8, 1, true)
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide })
      const shade = new THREE.Mesh(shadeGeo, shadeMat)
      shade.position.set(x, y + 0.2, z)
      scene.add(shade)
    }

    // --- ENVIRONMENT ---
    // The Hill/Ground
    const hillGeo = new THREE.CylinderGeometry(20, 22, 1.5, 32)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 1 })
    const hill = new THREE.Mesh(hillGeo, hillMat)
    hill.position.y = -0.75
    hill.receiveShadow = true
    scene.add(hill)

    // Grass patches
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d3d2d, roughness: 1 })
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 8 + Math.random() * 10
      const grassGeo = new THREE.ConeGeometry(0.1, 0.3, 4)
      const grass = new THREE.Mesh(grassGeo, grassMat)
      grass.position.set(Math.cos(angle) * dist, 0.15, Math.sin(angle) * dist)
      grass.rotation.x = (Math.random() - 0.5) * 0.2
      scene.add(grass)
    }

    // Rain
    const rainCount = 6000
    const rainGeo = new THREE.BufferGeometry()
    const rainPos: number[] = []
    for (let i = 0; i < rainCount; i++) {
      rainPos.push(
        (Math.random() - 0.5) * 50,
        Math.random() * 25,
        (Math.random() - 0.5) * 50
      )
    }
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3))
    const rainMat = new THREE.PointsMaterial({
      color: 0x888899,
      size: 0.04,
      transparent: true,
      opacity: 0.6
    })
    const rainSystem = new THREE.Points(rainGeo, rainMat)
    scene.add(rainSystem)

    // --- MATERIALS ---
    const woodFloorMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 })
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 })
    const darkWallMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
    const carpetRedMat = new THREE.MeshStandardMaterial({ color: 0x4a1515, roughness: 1 })
    const carpetBlueMat = new THREE.MeshStandardMaterial({ color: 0x152535, roughness: 1 })
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.3 })

    // --- HOUSE STRUCTURE ---
    // Floor
    const floorGeo = new THREE.BoxGeometry(12, 0.3, 10)
    const floor = new THREE.Mesh(floorGeo, woodFloorMat)
    floor.receiveShadow = true
    houseGroup.add(floor)

    // Helper functions
    const createWall = (x: number, y: number, z: number, w: number, h: number, d: number, mat = wallMat) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      wall.position.set(x, y, z)
      wall.castShadow = true
      wall.receiveShadow = true
      houseGroup.add(wall)
      return wall
    }

    const createBox = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      houseGroup.add(mesh)
      return mesh
    }

    // Exterior walls
    createWall(0, 2, -5, 12, 4, 0.2) // Back
    createWall(-6, 2, 0, 0.2, 4, 10) // Left
    createWall(6, 2, 0, 0.2, 4, 10) // Right
    createWall(-3, 2, 5, 6, 4, 0.2) // Front left
    createWall(3, 2, 5, 6, 4, 0.2) // Front right (with gap for door)

    // Interior dividing walls
    createWall(0, 2, -1.5, 12, 4, 0.15) // Bedroom/living divider
    createWall(-1.5, 2, -3.25, 0.15, 4, 3.5) // Between bedrooms

    // Door frames (darker)
    createWall(-1.5, 3.2, -1.5, 0.8, 0.8, 0.2, darkWallMat) // Ethan door top
    createWall(1.5, 3.2, -1.5, 0.8, 0.8, 0.2, darkWallMat) // Eli door top

    // === ETHAN'S ROOM (Left, Messy) ===
    // Red carpet
    createBox(-3.5, 0.16, -3, 4.5, 0.02, 3.5, carpetRedMat)

    // Bed (unmade, messy)
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    const bedSheetMat = new THREE.MeshStandardMaterial({ color: 0x2a1515 })
    createBox(-4.5, 0.4, -3.5, 2, 0.5, 1.2, bedFrameMat) // Frame
    createBox(-4.5, 0.7, -3.5, 1.9, 0.3, 1.1, bedSheetMat) // Mattress
    createBox(-5.2, 0.9, -3.5, 0.4, 0.2, 0.8, new THREE.MeshStandardMaterial({ color: 0x333333 })) // Pillow

    // Blanket (crumpled)
    createBox(-4.2, 0.85, -3.3, 1.2, 0.15, 0.9, new THREE.MeshStandardMaterial({ color: 0x1a0505 }))
    createBox(-4.0, 0.9, -3.6, 0.8, 0.1, 0.6, new THREE.MeshStandardMaterial({ color: 0x1a0505 }))

    // Desk with computer setup
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    createBox(-2.5, 0.9, -4.3, 2, 0.1, 0.8, deskMat) // Desk top
    createBox(-3.3, 0.45, -4.3, 0.1, 0.8, 0.6, deskMat) // Left leg
    createBox(-1.7, 0.45, -4.3, 0.1, 0.8, 0.6, deskMat) // Right leg

    // Monitors (multiple)
    const monitorMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
    const screenMat = new THREE.MeshBasicMaterial({ color: isNight ? 0x003300 : 0x001100 }) // Green glow
    createBox(-2.8, 1.5, -4.5, 0.8, 0.5, 0.05, monitorMat) // Monitor 1
    createBox(-2.8, 1.5, -4.45, 0.7, 0.4, 0.02, screenMat)
    createBox(-2.0, 1.5, -4.5, 0.6, 0.4, 0.05, monitorMat) // Monitor 2
    createBox(-2.0, 1.5, -4.45, 0.5, 0.3, 0.02, screenMat)

    // Keyboard
    createBox(-2.5, 0.97, -4.0, 0.5, 0.03, 0.15, new THREE.MeshStandardMaterial({ color: 0x222222 }))

    // Gaming chair
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1a0000 })
    createBox(-2.5, 0.5, -3.5, 0.5, 0.6, 0.5, chairMat)
    createBox(-2.5, 1.1, -3.7, 0.5, 0.7, 0.1, chairMat)

    // Trash and clutter
    const trashMat = new THREE.MeshStandardMaterial({ color: 0x888888 })
    for (let i = 0; i < 8; i++) {
      const x = -4.5 + Math.random() * 3
      const z = -4 + Math.random() * 2.5
      createBox(x, 0.18 + Math.random() * 0.1, z, 0.15 + Math.random() * 0.1, 0.08, 0.1 + Math.random() * 0.1, trashMat)
    }

    // Energy drink cans
    const canMat = new THREE.MeshStandardMaterial({ color: 0x00aa00 })
    for (let i = 0; i < 4; i++) {
      const canGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8)
      const can = new THREE.Mesh(canGeo, canMat)
      can.position.set(-2.5 + i * 0.15, 0.97 + 0.075, -4.2)
      can.rotation.x = Math.random() * 0.3
      houseGroup.add(can)
    }

    // Pizza box
    createBox(-3.8, 0.18, -2.5, 0.5, 0.05, 0.5, new THREE.MeshStandardMaterial({ color: 0x8B4513 }))

    // Posters on wall (dark rectangles)
    createBox(-5.85, 2.5, -3, 0.02, 0.8, 0.6, new THREE.MeshStandardMaterial({ color: 0x111111 }))
    createBox(-5.85, 2.5, -4, 0.02, 0.6, 0.5, new THREE.MeshStandardMaterial({ color: 0x0a0a0a }))

    // Ethan's room lamp (red tint)
    createLamp(-3.5, 2.8, -3, 0xff3300, 1.2)

    // === ELI'S ROOM (Right, Neat) ===
    // Blue carpet
    createBox(3.5, 0.16, -3, 4.5, 0.02, 3.5, carpetBlueMat)

    // Bed (neatly made)
    const eliBedMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    const eliSheetMat = new THREE.MeshStandardMaterial({ color: 0x1a2535 })
    createBox(4.5, 0.4, -3.5, 2, 0.5, 1.2, eliBedMat)
    createBox(4.5, 0.7, -3.5, 1.9, 0.2, 1.1, eliSheetMat)
    createBox(5.2, 0.85, -3.5, 0.4, 0.15, 0.8, new THREE.MeshStandardMaterial({ color: 0x3a4555 }))
    // Neatly folded blanket at foot
    createBox(3.8, 0.8, -3.5, 0.3, 0.1, 1.0, new THREE.MeshStandardMaterial({ color: 0x253545 }))

    // Bookshelf
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f })
    createBox(2, 1.5, -4.5, 1.5, 2.5, 0.4, shelfMat)
    // Shelves
    createBox(2, 0.5, -4.5, 1.4, 0.05, 0.35, shelfMat)
    createBox(2, 1.3, -4.5, 1.4, 0.05, 0.35, shelfMat)
    createBox(2, 2.1, -4.5, 1.4, 0.05, 0.35, shelfMat)
    // Books
    const bookColors = [0x8B0000, 0x00008B, 0x006400, 0x4B0082, 0x8B4513]
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let i = 0; i < 6; i++) {
        const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length] })
        createBox(1.4 + i * 0.18, 0.3 + shelf * 0.8 + 0.15, -4.5, 0.12, 0.25 + Math.random() * 0.1, 0.2, bookMat)
      }
    }

    // Desk (neat)
    const eliDeskMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 })
    createBox(4, 0.9, -4.3, 1.8, 0.1, 0.8, eliDeskMat)
    createBox(3.2, 0.45, -4.3, 0.1, 0.8, 0.6, eliDeskMat)
    createBox(4.8, 0.45, -4.3, 0.1, 0.8, 0.6, eliDeskMat)

    // Laptop (closed)
    createBox(4, 0.97, -4.3, 0.4, 0.02, 0.3, new THREE.MeshStandardMaterial({ color: 0x333333 }))

    // Notebook and pen
    createBox(4.5, 0.96, -4.2, 0.2, 0.01, 0.25, new THREE.MeshStandardMaterial({ color: 0xf5f5dc }))
    createBox(4.7, 0.97, -4.2, 0.15, 0.01, 0.02, new THREE.MeshStandardMaterial({ color: 0x1a1a1a }))

    // Plant on desk
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    const potGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.15, 8)
    const pot = new THREE.Mesh(potGeo, potMat)
    pot.position.set(3.5, 1.02, -4.3)
    houseGroup.add(pot)
    // Plant leaves
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22 })
    for (let i = 0; i < 5; i++) {
      const leafGeo = new THREE.ConeGeometry(0.05, 0.2, 4)
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.set(3.5 + (Math.random() - 0.5) * 0.1, 1.15 + i * 0.05, -4.3 + (Math.random() - 0.5) * 0.1)
      leaf.rotation.x = (Math.random() - 0.5) * 0.5
      leaf.rotation.z = (Math.random() - 0.5) * 0.5
      houseGroup.add(leaf)
    }

    // Chair
    const eliChairMat = new THREE.MeshStandardMaterial({ color: 0x2a3545 })
    createBox(4, 0.5, -3.5, 0.5, 0.5, 0.5, eliChairMat)
    createBox(4, 1.0, -3.7, 0.5, 0.6, 0.08, eliChairMat)

    // Framed picture on wall
    createBox(5.85, 2.2, -3.5, 0.02, 0.6, 0.5, new THREE.MeshStandardMaterial({ color: 0x3d2b1f })) // Frame
    createBox(5.83, 2.2, -3.5, 0.01, 0.5, 0.4, new THREE.MeshStandardMaterial({ color: 0x87CEEB })) // Picture

    // Eli's room lamp (cool blue tint)
    createLamp(3.5, 2.8, -3, 0x4488ff, 1.0)

    // === LIVING ROOM (Front) ===
    // Rug
    createBox(0, 0.16, 2.5, 4, 0.02, 3, new THREE.MeshStandardMaterial({ color: 0x2a2a2a }))

    // Couch
    const couchMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
    createBox(0, 0.5, 3.5, 3, 0.6, 1, couchMat) // Base
    createBox(0, 1.0, 4.1, 3, 0.6, 0.2, couchMat) // Back
    createBox(-1.6, 0.7, 3.5, 0.2, 0.4, 1, couchMat) // Left arm
    createBox(1.6, 0.7, 3.5, 0.2, 0.4, 1, couchMat) // Right arm
    // Cushions
    createBox(-0.7, 0.85, 3.5, 0.8, 0.15, 0.7, new THREE.MeshStandardMaterial({ color: 0x3a3a3a }))
    createBox(0.7, 0.85, 3.5, 0.8, 0.15, 0.7, new THREE.MeshStandardMaterial({ color: 0x3a3a3a }))

    // Coffee table
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
    createBox(0, 0.4, 2, 1.5, 0.08, 0.8, tableMat)
    createBox(-0.6, 0.2, 1.7, 0.08, 0.35, 0.08, tableMat)
    createBox(0.6, 0.2, 1.7, 0.08, 0.35, 0.08, tableMat)
    createBox(-0.6, 0.2, 2.3, 0.08, 0.35, 0.08, tableMat)
    createBox(0.6, 0.2, 2.3, 0.08, 0.35, 0.08, tableMat)
    // Mug on table
    const mugGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8)
    const mug = new THREE.Mesh(mugGeo, new THREE.MeshStandardMaterial({ color: 0x8B4513 }))
    mug.position.set(0.3, 0.49, 2)
    houseGroup.add(mug)

    // TV and stand
    createBox(-4, 0.5, 1.5, 0.8, 0.8, 0.4, new THREE.MeshStandardMaterial({ color: 0x1a1a1a })) // Stand
    createBox(-4, 1.3, 1.5, 1.5, 1, 0.1, new THREE.MeshStandardMaterial({ color: 0x111111 })) // TV
    createBox(-4, 1.3, 1.45, 1.4, 0.9, 0.02, new THREE.MeshBasicMaterial({ color: isNight ? 0x111122 : 0x080810 })) // Screen

    // Floor lamp
    const lampStandGeo = new THREE.CylinderGeometry(0.03, 0.05, 1.5, 8)
    const lampStand = new THREE.Mesh(lampStandGeo, metalMat)
    lampStand.position.set(4, 0.9, 2)
    houseGroup.add(lampStand)
    createLamp(4, 1.8, 2, 0xffeecc, 1.0)

    // Potted plant in corner
    const bigPotGeo = new THREE.CylinderGeometry(0.25, 0.2, 0.4, 8)
    const bigPot = new THREE.Mesh(bigPotGeo, potMat)
    bigPot.position.set(5, 0.35, 4)
    houseGroup.add(bigPot)
    // Big plant
    for (let i = 0; i < 8; i++) {
      const bigLeafGeo = new THREE.ConeGeometry(0.1, 0.5, 4)
      const bigLeaf = new THREE.Mesh(bigLeafGeo, leafMat)
      bigLeaf.position.set(5 + (Math.random() - 0.5) * 0.2, 0.7 + i * 0.08, 4 + (Math.random() - 0.5) * 0.2)
      bigLeaf.rotation.x = (Math.random() - 0.5) * 0.4
      bigLeaf.rotation.z = (Math.random() - 0.5) * 0.4
      houseGroup.add(bigLeaf)
    }

    scene.add(houseGroup)

    // Roof
    const roofGeo = new THREE.ConeGeometry(10, 4, 4)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 5
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    roofGroup.add(roof)
    scene.add(roofGroup)

    // === CHARACTERS ===

    // Create character helper
    const createCharacter = (skinColor: number, hairColor: number, shirtColor: number, pantsColor: number, hasHair: boolean, hairStyle: string) => {
      const group = new THREE.Group()

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 0.25)
      const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor })
      const body = new THREE.Mesh(bodyGeo, bodyMat)
      body.position.y = 0.7
      body.castShadow = true
      group.add(body)

      // Head
      const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.28)
      const headMat = new THREE.MeshStandardMaterial({ color: skinColor })
      const head = new THREE.Mesh(headGeo, headMat)
      head.position.y = 1.2
      head.castShadow = true
      group.add(head)

      // Hair
      if (hasHair) {
        const hairMat = new THREE.MeshStandardMaterial({ color: hairColor })
        if (hairStyle === 'short') {
          const hairGeo = new THREE.BoxGeometry(0.32, 0.15, 0.3)
          const hair = new THREE.Mesh(hairGeo, hairMat)
          hair.position.set(0, 1.4, 0)
          group.add(hair)
        } else if (hairStyle === 'messy') {
          for (let i = 0; i < 6; i++) {
            const strandGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08)
            const strand = new THREE.Mesh(strandGeo, hairMat)
            strand.position.set((Math.random() - 0.5) * 0.25, 1.38, (Math.random() - 0.5) * 0.2)
            strand.rotation.set(Math.random() * 0.3, 0, Math.random() * 0.3)
            group.add(strand)
          }
        } else if (hairStyle === 'tidy') {
          const hairGeo = new THREE.BoxGeometry(0.32, 0.12, 0.3)
          const hair = new THREE.Mesh(hairGeo, hairMat)
          hair.position.set(0, 1.38, 0)
          group.add(hair)
          // Side hair
          const sideHairGeo = new THREE.BoxGeometry(0.05, 0.2, 0.28)
          const sideHairL = new THREE.Mesh(sideHairGeo, hairMat)
          sideHairL.position.set(-0.17, 1.25, 0)
          group.add(sideHairL)
          const sideHairR = new THREE.Mesh(sideHairGeo, hairMat)
          sideHairR.position.set(0.17, 1.25, 0)
          group.add(sideHairR)
        }
      }

      // Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 })
      const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02)
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
      eyeL.position.set(-0.08, 1.22, 0.14)
      group.add(eyeL)
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
      eyeR.position.set(0.08, 1.22, 0.14)
      group.add(eyeR)

      // Legs
      const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15)
      const legMat = new THREE.MeshStandardMaterial({ color: pantsColor })
      const legL = new THREE.Mesh(legGeo, legMat)
      legL.position.set(-0.1, 0.25, 0)
      legL.castShadow = true
      group.add(legL)
      const legR = new THREE.Mesh(legGeo, legMat)
      legR.position.set(0.1, 0.25, 0)
      legR.castShadow = true
      group.add(legR)

      // Arms
      const armGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1)
      const armMat = new THREE.MeshStandardMaterial({ color: shirtColor })
      const armL = new THREE.Mesh(armGeo, armMat)
      armL.position.set(-0.28, 0.65, 0)
      armL.castShadow = true
      group.add(armL)
      const armR = new THREE.Mesh(armGeo, armMat)
      armR.position.set(0.28, 0.65, 0)
      armR.castShadow = true
      group.add(armR)

      return group
    }

    // Rene - Short dark hair, tattoos (shown as dark marks on arms), casual clothes
    rene.mesh = createCharacter(0xd4a574, 0x1a1a1a, 0x2a2a2a, 0x1a1a1a, true, 'short')
    // Add tattoo marks on arms
    const tattooMat = new THREE.MeshBasicMaterial({ color: 0x333344 })
    const tattooGeo = new THREE.BoxGeometry(0.03, 0.1, 0.03)
    const tattoo1 = new THREE.Mesh(tattooGeo, tattooMat)
    tattoo1.position.set(-0.28, 0.7, 0.06)
    rene.mesh.add(tattoo1)
    const tattoo2 = new THREE.Mesh(tattooGeo, tattooMat)
    tattoo2.position.set(-0.28, 0.55, 0.06)
    rene.mesh.add(tattoo2)
    const tattoo3 = new THREE.Mesh(tattooGeo, tattooMat)
    tattoo3.position.set(0.28, 0.65, 0.06)
    rene.mesh.add(tattoo3)
    rene.mesh.position.set(0, 0.15, 2.5)
    rene.mesh.name = 'Rene'
    scene.add(rene.mesh)

    // Ethan - Messy look, dark hoodie, tired posture
    ethan.mesh = createCharacter(0xc9a86c, 0x2a1a0a, 0x1a0505, 0x111111, true, 'messy')
    ethan.mesh.position.set(-3.5, 0.15, -3)
    ethan.mesh.rotation.y = Math.PI * 0.3
    ethan.mesh.name = 'Ethan'
    scene.add(ethan.mesh)

    // Eli - Tidy hair, neat blue sweater, calm posture
    eli.mesh = createCharacter(0xc9a86c, 0x2a2015, 0x1a3050, 0x2a2a2a, true, 'tidy')
    eli.mesh.position.set(4, 0.15, -3)
    eli.mesh.rotation.y = -Math.PI * 0.2
    eli.mesh.name = 'Eli'
    scene.add(eli.mesh)

    // Mouse click handler
    const onMouseClick = (event: MouseEvent) => {
      if (threeRef.current?.gameState !== 'PLAY') return

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)

      for (const intersect of intersects) {
        let obj = intersect.object
        while (obj.parent && obj.parent !== scene) {
          obj = obj.parent as THREE.Object3D
        }

        if (obj.name === 'Ethan') {
          const phrases = [
            "W-what was that noise? Did you hear it?",
            "The code won't compile... it never does at 3 AM.",
            "*barely looks up* What do you want?",
            "I've been tracking something strange online...",
            "Don't touch my energy drinks. They're organized.",
            "Eli keeps telling me to sleep. He doesn't get it."
          ]
          setDialogue({ name: 'ETHAN', text: phrases[Math.floor(Math.random() * phrases.length)] })
          break
        }
        if (obj.name === 'Eli') {
          const phrases = [
            "The rain is quite soothing today, isn't it?",
            "I found a lovely passage about migration patterns.",
            "Have you eaten? I could make tea.",
            "Ethan's been up for 36 hours. I'm worried.",
            "Sometimes the quiet is the loudest thing.",
            "Would you like to sit? The couch is comfortable."
          ]
          setDialogue({ name: 'ELI', text: phrases[Math.floor(Math.random() * phrases.length)] })
          break
        }
      }
    }

    renderer.domElement.addEventListener('click', onMouseClick)

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Animation loop
    const animate = () => {
      if (!threeRef.current) return
      requestAnimationFrame(animate)

      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      // Rain animation
      const positions = rainSystem.geometry.attributes.position.array as Float32Array
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.4
        if (positions[i] < 0) {
          positions[i] = 25
        }
      }
      rainSystem.geometry.attributes.position.needsUpdate = true

      // Character idle animations
      if (ethan.mesh && eli.mesh && rene.mesh) {
        // Ethan - nervous fidgeting
        ethan.mesh.position.y = 0.15 + Math.sin(time * 3) * 0.015
        ethan.mesh.rotation.y = Math.PI * 0.3 + Math.sin(time * 0.5) * 0.1

        // Eli - calm breathing
        eli.mesh.position.y = 0.15 + Math.sin(time * 1.5) * 0.01

        // Rene movement (WASD) - only in PLAY mode
        if (threeRef.current.gameState === 'PLAY' && rene.mesh) {
          const moveSpeed = 3 * delta
          let moved = false

          if (keysRef.current['w']) {
            rene.mesh.position.z -= moveSpeed
            rene.mesh.rotation.y = Math.PI
            moved = true
          }
          if (keysRef.current['s']) {
            rene.mesh.position.z += moveSpeed
            rene.mesh.rotation.y = 0
            moved = true
          }
          if (keysRef.current['a']) {
            rene.mesh.position.x -= moveSpeed
            rene.mesh.rotation.y = Math.PI / 2
            moved = true
          }
          if (keysRef.current['d']) {
            rene.mesh.position.x += moveSpeed
            rene.mesh.rotation.y = -Math.PI / 2
            moved = true
          }

          // Walking animation
          if (moved) {
            rene.mesh.position.y = 0.15 + Math.abs(Math.sin(time * 12)) * 0.05
          } else {
            rene.mesh.position.y = 0.15 + Math.sin(time * 2) * 0.01
          }

          // Boundary constraints
          rene.mesh.position.x = Math.max(-5.5, Math.min(5.5, rene.mesh.position.x))
          rene.mesh.position.z = Math.max(-4.5, Math.min(4.5, rene.mesh.position.z))

          // Camera follows Rene
          threeRef.current.cameraTarget.lerp(rene.mesh.position, 0.05)
          camera.position.x = threeRef.current.cameraTarget.x
          camera.position.z = threeRef.current.cameraTarget.z + 8
          camera.lookAt(threeRef.current.cameraTarget.x, 1, threeRef.current.cameraTarget.z)
        }
      }

      // Menu camera rotation
      if (threeRef.current.gameState === 'MENU') {
        threeRef.current.cameraAngle += 0.003
        camera.position.x = Math.sin(threeRef.current.cameraAngle) * 18
        camera.position.z = Math.cos(threeRef.current.cameraAngle) * 18
        camera.position.y = 8
        camera.lookAt(0, 1, 0)
      }

      renderer.render(scene, camera)
    }

    animate()

    // Resize handler
    const onResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      const h = containerRef.current.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', onResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('click', onMouseClick)
      renderer.dispose()
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
      threeRef.current = null
    }
  }, [])

  const startGame = () => {
    setGameState('PLAY')
    if (threeRef.current) {
      threeRef.current.gameState = 'PLAY'
      threeRef.current.scene.remove(threeRef.current.roofGroup)
      threeRef.current.camera.position.set(0, 10, 10)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Minimal Header */}
      <div className="absolute top-4 left-4 z-20">
        <Link
          href="/"
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
          <span className="text-sm uppercase tracking-widest font-mono">Back</span>
        </Link>
      </div>

      {/* Controls hint */}
      {gameState === 'PLAY' && (
        <div className="absolute top-4 right-4 z-20 text-white/50 font-mono text-sm">
          WASD to move | Click characters to talk
        </div>
      )}

      {/* 3D Canvas Container */}
      <div ref={containerRef} className="flex-1 relative">
        {/* Start Screen Overlay */}
        {gameState === 'MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
            <div className="text-center text-white pointer-events-auto">
              <h1 className="text-6xl font-mono tracking-[0.3em] mb-2" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
                ISOLATION
              </h1>
              <p className="text-lg opacity-70 mb-8 font-mono">
                It is raining. They are waiting.
              </p>
              <button
                onClick={startGame}
                className="bg-transparent border border-white text-white px-8 py-4 font-mono text-lg hover:bg-white hover:text-black transition-all"
              >
                ENTER HOUSE
              </button>
              <p className="text-sm opacity-50 mt-6 font-mono">
                Use WASD to move as Rene
              </p>
            </div>
          </div>
        )}

        {/* Dialogue Box */}
        {dialogue && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[60%] max-w-lg bg-black/90 border border-zinc-700 text-white p-5 z-20 font-mono">
            <button
              onClick={() => setDialogue(null)}
              className="absolute top-2 right-3 text-zinc-500 hover:text-white"
            >
              [x]
            </button>
            <div className="font-bold mb-2 uppercase tracking-wider text-zinc-400">{dialogue.name}</div>
            <div className="leading-relaxed">{dialogue.text}</div>
          </div>
        )}
      </div>
    </div>
  )
}
