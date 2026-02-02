'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function HousePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gameState, setGameState] = useState<'MENU' | 'PLAY'>('MENU')
  const [dialogue, setDialogue] = useState<{ name: string; text: string } | null>(null)
  const threeRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || threeRef.current) return

    // --- SETUP ---
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)
    scene.fog = new THREE.FogExp2(0x111111, 0.04)

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    camera.position.set(0, 5, 15)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.domElement.style.filter = 'grayscale(100%) contrast(120%) brightness(90%)'
    containerRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5

    const clock = new THREE.Clock()

    // Real-time day/night check
    const currentHour = new Date().getHours()
    const isNight = (currentHour >= 18 || currentHour < 6)

    // Game objects
    const houseGroup = new THREE.Group()
    const roofGroup = new THREE.Group()
    const ethan = { mesh: null as THREE.Mesh | null, name: 'Ethan' }
    const eli = { mesh: null as THREE.Mesh | null, name: 'Eli' }
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Store refs
    threeRef.current = { scene, camera, renderer, controls, roofGroup, ethan, eli, gameState: 'MENU' }

    // --- LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, isNight ? 0.2 : 0.8)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    scene.add(dirLight)

    // Lamp helper
    const createLamp = (x: number, y: number, z: number, color: number) => {
      const light = new THREE.PointLight(color, isNight ? 1.5 : 0, 8)
      light.position.set(x, y, z)
      light.castShadow = true
      scene.add(light)

      const bulbGeo = new THREE.SphereGeometry(0.2)
      const bulbMat = new THREE.MeshBasicMaterial({ color })
      const bulb = new THREE.Mesh(bulbGeo, bulbMat)
      bulb.position.set(x, y, z)
      scene.add(bulb)
    }

    createLamp(-3, 3, -3, 0xffaa00)
    createLamp(3, 3, -3, 0xaaccff)
    createLamp(0, 3, 2, 0xffffff)

    // --- ENVIRONMENT ---
    // The Hill
    const hillGeo = new THREE.CylinderGeometry(15, 15, 1, 32)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x223322, roughness: 1 })
    const hill = new THREE.Mesh(hillGeo, hillMat)
    hill.position.y = -0.5
    hill.receiveShadow = true
    scene.add(hill)

    // The Rain
    const rainCount = 5000
    const rainGeo = new THREE.BufferGeometry()
    const rainPos: number[] = []
    for (let i = 0; i < rainCount; i++) {
      rainPos.push(
        (Math.random() - 0.5) * 40,
        Math.random() * 20,
        (Math.random() - 0.5) * 40
      )
    }
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3))
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.05,
      transparent: true
    })
    const rainSystem = new THREE.Points(rainGeo, rainMat)
    scene.add(rainSystem)

    // --- HOUSE ---
    // Floor
    const floorGeo = new THREE.BoxGeometry(10, 0.2, 8)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x444444 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.receiveShadow = true
    houseGroup.add(floor)

    // Wall helper
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 })
    const createWall = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
      wall.position.set(x, y, z)
      wall.castShadow = true
      wall.receiveShadow = true
      houseGroup.add(wall)
    }

    // Box helper
    const createBox = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color })
      )
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      houseGroup.add(mesh)
    }

    // Walls
    createWall(0, 1.5, -4, 10, 3, 0.2)
    createWall(-5, 1.5, 0, 0.2, 3, 8)
    createWall(5, 1.5, 0, 0.2, 3, 8)
    createWall(0, 1.5, 4, 10, 3, 0.2)
    createWall(0, 1.5, -1, 10, 3, 0.2)
    createWall(0, 1.5, -2.5, 0.2, 3, 3)

    // Ethan's Room (Messy)
    createBox(-3, 0.5, -3.5, 1, 1, 0.5, 0x333333)
    createBox(-4, 0.2, -2, 1.2, 0.4, 2, 0x550000)
    for (let i = 0; i < 5; i++) {
      createBox(-3 + (Math.random() - 0.5), 0.1, -3 + (Math.random() - 0.5), 0.2, 0.1, 0.2, 0xffffff)
    }

    // Eli's Room (Neat)
    createBox(3, 0.5, -3.5, 1, 1, 0.5, 0x885522)
    createBox(4, 0.2, -2, 1.2, 0.4, 2, 0x000055)
    createBox(4.5, 1.5, -3, 0.1, 1, 1, 0xaaaaaa)

    // Living Room
    createBox(0, 0.4, 2, 2, 0.5, 1, 0x222222)
    createBox(-2, 0.8, 3.8, 1, 1.5, 0.5, 0xcccccc)

    scene.add(houseGroup)

    // Roof
    const roofGeo = new THREE.ConeGeometry(8, 3, 4)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
    const roof = new THREE.Mesh(roofGeo, roofMat)
    roof.position.y = 3
    roof.rotation.y = Math.PI / 4
    roofGroup.add(roof)
    scene.add(roofGroup)

    // --- CHARACTERS ---
    // Ethan
    const ethanGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8)
    const ethanMat = new THREE.MeshStandardMaterial({ color: 0x8B0000 })
    ethan.mesh = new THREE.Mesh(ethanGeo, ethanMat)
    ethan.mesh.position.set(-3, 0.7, -2)
    ethan.mesh.castShadow = true
    ethan.mesh.name = 'Ethan'
    scene.add(ethan.mesh)

    // Eli
    const eliGeo = new THREE.CapsuleGeometry(0.2, 1.0, 4, 8)
    const eliMat = new THREE.MeshStandardMaterial({ color: 0x4682B4 })
    eli.mesh = new THREE.Mesh(eliGeo, eliMat)
    eli.mesh.position.set(3, 0.8, -2)
    eli.mesh.castShadow = true
    eli.mesh.name = 'Eli'
    scene.add(eli.mesh)

    // Mouse click handler
    const onMouseClick = (event: MouseEvent) => {
      if (threeRef.current?.gameState !== 'PLAY') return

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children)

      if (intersects.length > 0) {
        const object = intersects[0].object
        if (object.name === 'Ethan') {
          const phrases = [
            "W-what was that noise? Did you hear it?",
            "Don't look at the windows. The tape keeps them out.",
            "I'm busy. Coding... or maybe hacking. Who asks?",
            "*munching on cold pizza* Can't talk."
          ]
          setDialogue({ name: 'ETHAN', text: phrases[Math.floor(Math.random() * phrases.length)] })
        }
        if (object.name === 'Eli') {
          const phrases = [
            "Did you see the blue jay outside? Fascinating.",
            "Ethan is having a rough day. Please be patient.",
            "I prefer the quiet. The rain helps me think.",
            "Would you like to read about migratory patterns?"
          ]
          setDialogue({ name: 'ELI', text: phrases[Math.floor(Math.random() * phrases.length)] })
        }
      }
    }

    renderer.domElement.addEventListener('click', onMouseClick)

    // Animation loop
    const animate = () => {
      if (!threeRef.current) return
      requestAnimationFrame(animate)

      const time = clock.getElapsedTime()

      // Rain animation
      const positions = rainSystem.geometry.attributes.position.array as Float32Array
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.3
        if (positions[i] < 0) {
          positions[i] = 20
        }
      }
      rainSystem.geometry.attributes.position.needsUpdate = true

      // Character idle animation
      if (ethan.mesh && eli.mesh) {
        ethan.mesh.position.y = 0.7 + Math.sin(time * 2) * 0.02
        eli.mesh.position.y = 0.8 + Math.cos(time * 1.5) * 0.02

        if (Math.random() < 0.01) ethan.mesh.rotation.y = Math.random() * Math.PI * 2
        if (Math.random() < 0.01) eli.mesh.rotation.y = Math.random() * Math.PI * 2
      }

      controls.update()
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

      // Remove roof
      threeRef.current.scene.remove(threeRef.current.roofGroup)

      // Stop auto-rotate and move camera inside
      threeRef.current.controls.autoRotate = false
      threeRef.current.camera.position.set(0, 10, 8)
      threeRef.current.camera.lookAt(0, 0, 0)
      threeRef.current.controls.target.set(0, 0, 0)
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
            </div>
          </div>
        )}

        {/* Dialogue Box */}
        {dialogue && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[60%] bg-black/80 border border-zinc-700 text-white p-5 z-20 font-mono">
            <button
              onClick={() => setDialogue(null)}
              className="absolute top-2 right-3 text-zinc-500 hover:text-white"
            >
              [x]
            </button>
            <div className="font-bold mb-2 uppercase tracking-wider">{dialogue.name}</div>
            <div className="leading-relaxed">{dialogue.text}</div>
          </div>
        )}
      </div>
    </div>
  )
}
