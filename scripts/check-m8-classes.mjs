#!/usr/bin/env node
/**
 * Check m8 Classes - Verify all classes used in member area are defined
 *
 * Every class used in TSX of app/member/{wallet,points,inbox}/** and
 * components/member/** must be defined in member-ui.css or be on a
 * Tailwind allow-list. Otherwise CI and build fail.
 *
 * This is the guard that would have caught the unstyled pages (Prompt 7 §1).
 *
 * Usage: node scripts/check-m8-classes.mjs
 * Exit 0 if all OK, exit 1 with error list if violations found.
*/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Tailwind utilities that are allowed (common layout/utility classes)
const TAILWIND_ALLOWLIST = [
  'flex',
  'flex-1',
  'flex-col',
  'items-center',
  'justify-center',
  'gap-1',
  'gap-2',
  'gap-3',
  'gap-4',
  'p-2',
  'p-4',
  'px-4',
  'py-2',
  'mt-2',
  'mt-4',
  'mb-2',
  'mb-4',
  'text-sm',
  'text-base',
  'font-medium',
  'font-bold',
  'rounded',
  'rounded-lg',
  'border',
  'bg-white',
  'hidden',
  'block',
  'inline',
  'w-full',
  'h-full',
  'min-w-0',
  'min-h-0',
  'max-w-',
  'max-h-',
  'opacity-',
  'transition',
  'duration-',
  'ease-',
  'hover:',
  'focus:',
  'active:',
  'aria-',
  'data-',
]

function extractClassesFromTsx(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const classes = new Set()

  // Match className="..." and className={`...`}
  const classNameRegex = /className\s*=\s*["'`]([^"'`]+)["'`]/g
  let match

  while ((match = classNameRegex.exec(content)) !== null) {
    const classString = match[1]
    // Split by whitespace and filter out empty strings
    classString.split(/\s+/).forEach(cls => {
      if (cls) classes.add(cls)
    })
  }

  return classes
}

function extractClassesFromCss(cssPath) {
  const content = fs.readFileSync(cssPath, 'utf8')
  const classes = new Set()

  // Match .classname { ... } (simplified, doesn't handle all edge cases)
  const classRegex = /\.([\w-]+)\s*[{,\s]/g
  let match

  while ((match = classRegex.exec(content)) !== null) {
    classes.add(match[1])
  }

  return classes
}

function isAllowedTailwind(className) {
  // Check if it's a Tailwind utility or starts with an allowed prefix
  return TAILWIND_ALLOWLIST.some(allowed => {
    if (allowed.endsWith('-') || allowed.endsWith(':')) {
      return className.startsWith(allowed)
    }
    return className === allowed
  })
}

async function main() {
  const memberUiCss = path.join(rootDir, 'app/member/member-ui.css')

  if (!fs.existsSync(memberUiCss)) {
    console.error('✗ member-ui.css not found')
    process.exit(1)
  }

  // Extract all classes defined in member-ui.css
  const definedClasses = extractClassesFromCss(memberUiCss)
  console.log(`Found ${definedClasses.size} classes in member-ui.css`)

  // Find all TSX files in member area
  const tsxFiles = await glob('app/member/{wallet,points,inbox}/**/*.tsx', { cwd: rootDir })
  const componentFiles = await glob('components/member/**/*.tsx', { cwd: rootDir })
  const allFiles = [...tsxFiles, ...componentFiles]

  console.log(`Checking ${allFiles.length} TSX files...`)

  const violations = []

  for (const file of allFiles) {
    const filePath = path.join(rootDir, file)
    const usedClasses = extractClassesFromTsx(filePath)

    for (const className of usedClasses) {
      // Skip if defined in CSS or allowed in Tailwind
      if (definedClasses.has(className) || isAllowedTailwind(className)) {
        continue
      }

      violations.push({ file, className })
    }
  }

  if (violations.length === 0) {
    console.log('✓ All classes are defined or allowed')
    process.exit(0)
  }

  console.error(`\n✗ Found ${violations.length} undefined classes:\n`)
  const byFile = {}
  violations.forEach(({ file, className }) => {
    if (!byFile[file]) byFile[file] = []
    byFile[file].push(className)
  })

  Object.entries(byFile).forEach(([file, classes]) => {
    console.error(`  ${file}:`)
    classes.forEach(cls => console.error(`    - ${cls}`))
  })

  console.error('\nAdd these to member-ui.css or the Tailwind allow-list.')
  process.exit(1)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
