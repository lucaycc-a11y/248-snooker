#!/usr/bin/env tsx
/**
 * Verify that all images referenced in venue-room-viewer data file exist on disk.
 * Fails the build if any image is missing.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { pills } from '../lib/data/venue-room-viewer'

const PUBLIC_DIR = join(process.cwd(), 'public')
const errors: string[] = []

function checkImage(src: string, context: string) {
  // Remove leading slash from src
  const relativePath = src.startsWith('/') ? src.slice(1) : src
  const fullPath = join(PUBLIC_DIR, relativePath)

  if (!existsSync(fullPath)) {
    errors.push(`Missing image: ${src} (context: ${context})`)
  }
}

console.log('Checking venue room viewer images...')

pills.forEach((pill) => {
  const context = `pill:${pill.id}`

  if (pill.perRoom) {
    checkImage(pill.perRoom.infinity.src, `${context}/infinity`)
    checkImage(pill.perRoom.eternity.src, `${context}/eternity`)
  }

  if (pill.views) {
    pill.views.forEach((view) => {
      checkImage(view.image.src, `${context}/view:${view.key}`)
    })
  }

  if (pill.eternityViews) {
    pill.eternityViews.forEach((view) => {
      checkImage(view.image.src, `${context}/eternityView:${view.key}`)
    })
  }

  if (pill.pilotImage) {
    checkImage(pill.pilotImage.src, `${context}/pilot`)
  }
})

if (errors.length > 0) {
  console.error('\n❌ Image check failed:\n')
  errors.forEach((err) => console.error(`  ${err}`))
  console.error(`\nTotal: ${errors.length} missing image(s)\n`)
  process.exit(1)
} else {
  console.log('✅ All venue room viewer images exist')
}
