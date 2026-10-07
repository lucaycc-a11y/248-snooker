#!/usr/bin/env tsx
/**
 * Verify that all images referenced in room-viewer.data.ts exist on disk.
 * Also verifies every src in lib/seo/imageManifest.ts (exact case). Fails the build if any image is missing or wrongly cased.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, sep } from 'path'
import { IMAGE_MANIFEST, MAIN_PHOTOS } from '../lib/seo/imageManifest'

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

// ── SEO image manifest (lib/seo/imageManifest.ts) ─────────────────────────
// Each src must exist on disk with exact case. existsSync is case-insensitive
// on macOS, so compare each path segment against readdirSync.
function existsExactCase(absPath: string): boolean {
  const rel = relative(ROOT_DIR, absPath)
  let current = ROOT_DIR
  for (const segment of rel.split(sep)) {
    if (!existsSync(current) || !readdirSync(current).includes(segment)) return false
    current = join(current, segment)
  }
  return statSync(current).isFile()
}

const manifestSrcs = IMAGE_MANIFEST.map((img) => img.src)
const allManifestSrcs = [...new Set([...manifestSrcs, ...MAIN_PHOTOS])]
console.log(`\n🔍 Checking ${allManifestSrcs.length} image(s) from lib/seo/imageManifest.ts...\n`)

for (const src of allManifestSrcs) {
  if (!src.startsWith('/')) {
    console.error(`❌ Manifest src must start with "/": ${src}`)
    allGood = false
    continue
  }
  if (!existsExactCase(join(PUBLIC_DIR, src.slice(1)))) {
    console.error(`❌ Missing or wrongly cased (manifest): ${src}`)
    allGood = false
  } else {
    console.log(`✅ ${src}`)
  }
}

for (const src of MAIN_PHOTOS) {
  if (!manifestSrcs.includes(src)) {
    console.error(`❌ MAIN_PHOTOS entry is not in IMAGE_MANIFEST: ${src}`)
    allGood = false
  }
}

if (allGood) {
  console.log(`\n✅ All ${imagePaths.length + allManifestSrcs.length} image(s) exist and are correctly cased.`)
  process.exit(0)
} else {
  console.error('\n❌ Image check failed. Fix missing or wrongly cased images before building.')
  process.exit(1)
}

