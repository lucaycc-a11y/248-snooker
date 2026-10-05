#!/usr/bin/env tsx
/**
 * Verify that all images referenced in room-viewer.data.ts exist on disk.
 * Fails the build if any image is missing or wrongly cased.
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT_DIR = process.cwd()
const DATA_FILE = join(ROOT_DIR, 'components/venue/room-viewer/room-viewer.data.ts')
const PUBLIC_DIR = join(ROOT_DIR, 'public')

if (!existsSync(DATA_FILE)) {
  console.error(`❌ Error: ${DATA_FILE} not found`)
  process.exit(1)
}

const content = readFileSync(DATA_FILE, 'utf-8')

// Extract all src: '/...' values (matches: src: '/images/foo.webp' or src: "/images/foo.webp")
const srcPattern = /src:\s*['"]([^'"]+)['"]/g
const matches = [...content.matchAll(srcPattern)]

if (matches.length === 0) {
  console.warn('⚠️  Warning: No image src paths found in room-viewer.data.ts')
  process.exit(0)
}

const imagePaths = matches.map((m) => m[1]).filter((p) => p.startsWith('/'))

console.log(`🔍 Checking ${imagePaths.length} image(s) from room-viewer.data.ts...\n`)

let allGood = true

for (const imagePath of imagePaths) {
  // Remove leading slash for filesystem path
  const relativePath = imagePath.slice(1)
  const fullPath = join(PUBLIC_DIR, relativePath)

  if (!existsSync(fullPath)) {
    console.error(`❌ Missing: ${imagePath}`)
    console.error(`   Expected at: ${fullPath}\n`)
    allGood = false
  } else {
    // Verify it's a file, not a directory
    const stats = statSync(fullPath)
    if (!stats.isFile()) {
      console.error(`❌ Not a file: ${imagePath}`)
      console.error(`   Path exists but is not a file: ${fullPath}\n`)
      allGood = false
    } else {
      console.log(`✅ ${imagePath}`)
    }
  }
}

if (allGood) {
  console.log(`\n✅ All ${imagePaths.length} image(s) exist and are correctly cased.`)
  process.exit(0)
} else {
  console.error('\n❌ Image check failed. Fix missing or wrongly cased images before building.')
  process.exit(1)
}

