"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import * as THREE from "three"
import { type PlanetName, PLANET_METADATA } from "@/lib/member/planetSystem"

// Procedural planet texture generator using simplex noise simulation
function generatePlanetTexture(planetName: PlanetName, size: number = 512): THREE.Texture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  const meta = PLANET_METADATA[planetName]
  const seed = planetName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)

  // Base color from planet metadata
  const baseColor = meta.color

  // Create gradient base
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, baseColor)
  gradient.addColorStop(1, darkenColor(baseColor, 60))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  // Add procedural surface features (craters, landmasses, clouds)
  const imageData = ctx.getImageData(0, 0, size, size)
  const data = imageData.data

  // Pseudo-random noise generation based on planet seed
  function noise(x: number, y: number, scale: number): number {
    const n = Math.sin((x * 12.9898 + y * 78.233 + seed) * scale) * 43758.5453
    return n - Math.floor(n)
  }

  // Multi-octave noise for realistic surface detail
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Multiple noise layers for detail
      const n1 = noise(x, y, 0.01) * 0.5
      const n2 = noise(x, y, 0.03) * 0.3
      const n3 = noise(x, y, 0.1) * 0.2

      const combined = (n1 + n2 + n3) * 255

      // Modulate existing color with noise
      data[idx] = Math.min(255, data[idx] + combined * 0.3)
      data[idx + 1] = Math.min(255, data[idx + 1] + combined * 0.3)
      data[idx + 2] = Math.min(255, data[idx + 2] + combined * 0.3)
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.max(0, ((num >> 16) & 255) - percent)
  const g = Math.max(0, ((num >> 8) & 255) - percent)
  const b = Math.max(0, (num & 255) - percent)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

// Atmospheric glow effect (rim light)
function PlanetAtmosphere({ radius }: { radius: number }) {
  return (
    <mesh scale={[1.08, 1.08, 1.08]}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshBasicMaterial
        color="#22c55e"
        transparent
        opacity={0.15}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Main 3D planet sphere with rotation
function PlanetSphere({ planetName, phase }: { planetName: PlanetName; phase: string }) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Generate texture once and memoize
  const texture = useMemo(() => generatePlanetTexture(planetName), [planetName])

  // Continuous rotation
  useFrame(() => {
    if (meshRef.current && phase !== "loading") {
      meshRef.current.rotation.y += 0.002
    }
  })

  const radius = 1

  return (
    <group>
      {/* Main planet sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Atmospheric glow */}
      <PlanetAtmosphere radius={radius} />
    </group>
  )
}

// 3D Scene setup
function Scene({ planetName, phase }: { planetName: PlanetName; phase: string }) {
  return (
    <>
      {/* Camera positioned to view planet */}
      <ambientLight intensity={0.3} />

      {/* Key light (sun) from upper right */}
      <directionalLight
        position={[5, 3, 5]}
        intensity={1.5}
        castShadow
      />

      {/* Fill light from left to soften shadows */}
      <directionalLight
        position={[-3, 1, -2]}
        intensity={0.4}
      />

      {/* Rim light from behind */}
      <directionalLight
        position={[0, -2, -5]}
        intensity={0.3}
        color="#22c55e"
      />

      <PlanetSphere planetName={planetName} phase={phase} />
    </>
  )
}

// Main export - 3D Canvas wrapper
export function Planet3D({
  planetName,
  phase,
  width = 400,
  height = 400
}: {
  planetName: PlanetName
  phase: string
  width?: number
  height?: number
}) {
  return (
    <div style={{ width, height, margin: "0 auto" }}>
      <Canvas
        dpr={[1, 1.5]} // Limit DPR for performance on mobile
        camera={{ position: [0, 0, 3], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
        style={{ background: "transparent" }}
      >
        <Scene planetName={planetName} phase={phase} />
      </Canvas>
    </div>
  )
}
