#!/usr/bin/env node

/**
 * Update Visual Baselines Script
 *
 * Runs Playwright tests to capture fresh baseline screenshots
 * for visual regression testing.
 *
 * Usage: node scripts/update-visual-baselines.mjs
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASELINE_DIR = path.resolve(__dirname, '../tests/visual/baseline')
const TEMP_DIR = path.resolve(__dirname, '../tests/visual/.temp')

console.log('🔄 Updating visual regression baselines...\n')

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// Backup existing baselines
if (fs.existsSync(BASELINE_DIR)) {
  const backupDir = `${BASELINE_DIR}_backup_${Date.now()}`
  console.log(`📦 Backing up existing baselines to ${path.basename(backupDir)}`)
  fs.renameSync(BASELINE_DIR, backupDir)
}

// Ensure baseline directory exists
if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
}

try {
  // Run Playwright visual tests
  // On first run (no baselines), tests will create them and skip comparison
  console.log('📸 Capturing fresh screenshots...\n')

  // Note: execSync is safe here as there is no user input
  execSync('npx playwright test tests/visual/member-pages.spec.ts', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  })

  console.log('\n✅ Baselines updated successfully!')
  console.log(`📁 Location: ${BASELINE_DIR}`)

  // List created baselines
  const baselines = fs.readdirSync(BASELINE_DIR)
  console.log('\n📋 Baseline files:')
  baselines.forEach(file => {
    console.log(`  - ${file}`)
  })

} catch (error) {
  console.error('\n❌ Error updating baselines:', error.message)
  process.exit(1)
}
