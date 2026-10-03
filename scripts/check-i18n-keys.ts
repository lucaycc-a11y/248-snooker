#!/usr/bin/env tsx
/**
 * AST-based i18n key scanner for Space8 member area.
 * Finds all useTranslations() and t() calls, extracts keys, checks against locale JSON.
 */

import { Project, SyntaxKind } from 'ts-morph'
import * as fs from 'fs'
import * as path from 'path'

const LOCALES = ['en', 'zh-HK', 'zh-CN', 'ja']
const MEMBER_AREA_PATHS = [
  'app/member',
  'components/member',
  'components/wallet',
  'components/points',
  'components/inbox',
]

interface I18nKey {
  key: string
  file: string
  line: number
}

function extractNamespace(sourceFile: any): string | null {
  // Find useTranslations('namespace') calls
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    const expr = call.getExpression()
    if (expr.getText() !== 'useTranslations') continue

    const args = call.getArguments()
    if (args.length === 0) continue

    const firstArg = args[0]
    if (firstArg.getKind() === SyntaxKind.StringLiteral) {
      return firstArg.getText().replace(/['"]/g, '')
    }
  }

  return null
}

function extractKeys(project: Project): I18nKey[] {
  const keys: I18nKey[] = []
  const sourceFiles = project.getSourceFiles()

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath()

    // Only scan member area files
    if (!MEMBER_AREA_PATHS.some(p => filePath.includes(p))) continue

    // Extract namespace from useTranslations() call
    const namespace = extractNamespace(sourceFile)

    // Find all t('key') or t("key") calls
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const expr = call.getExpression()
      if (expr.getText() !== 't') continue

      const args = call.getArguments()
      if (args.length === 0) continue

      const firstArg = args[0]
      if (firstArg.getKind() === SyntaxKind.StringLiteral) {
        let key = firstArg.getText().replace(/['"]/g, '')

        // Prefix with namespace if present
        if (namespace) {
          key = `${namespace}.${key}`
        }

        keys.push({
          key,
          file: path.relative(process.cwd(), filePath),
          line: firstArg.getStartLineNumber(),
        })
      }
    }
  }

  return keys
}

function loadLocaleKeys(locale: string): Set<string> {
  const filePath = path.join(process.cwd(), 'messages', `${locale}.json`)
  if (!fs.existsSync(filePath)) return new Set()

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const result: string[] = []
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result.push(...flattenKeys(value as Record<string, unknown>, fullKey))
      } else {
        result.push(fullKey)
      }
    }
    return result
  }

  return new Set(flattenKeys(content))
}

function main() {
  console.log('🔍 Scanning member area for i18n keys...\n')

  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
  })

  // Add source files
  for (const basePath of MEMBER_AREA_PATHS) {
    const fullPath = path.join(process.cwd(), basePath)
    if (fs.existsSync(fullPath)) {
      project.addSourceFilesAtPaths(`${fullPath}/**/*.{ts,tsx}`)
    }
  }

  const usedKeys = extractKeys(project)
  console.log(`Found ${usedKeys.length} i18n key usages\n`)

  // Load all locale files
  const localeKeys: Record<string, Set<string>> = {}
  for (const locale of LOCALES) {
    localeKeys[locale] = loadLocaleKeys(locale)
    console.log(`Loaded ${localeKeys[locale].size} keys from ${locale}.json`)
  }
  console.log()

  // Find missing keys per locale
  const missingByLocale: Record<string, I18nKey[]> = {}
  let totalMissing = 0

  for (const locale of LOCALES) {
    missingByLocale[locale] = usedKeys.filter(({ key }) => !localeKeys[locale].has(key))
    totalMissing += missingByLocale[locale].length
  }

  if (totalMissing === 0) {
    console.log('✅ All i18n keys are defined in all locales!')
    process.exit(0)
  }

  console.log(`❌ Found ${totalMissing} missing keys across all locales:\n`)

  for (const locale of LOCALES) {
    const missing = missingByLocale[locale]
    if (missing.length === 0) continue

    console.log(`\n${locale}.json — ${missing.length} missing:`)

    // Group by key to avoid duplicates
    const uniqueKeys = new Map<string, I18nKey>()
    for (const item of missing) {
      if (!uniqueKeys.has(item.key)) uniqueKeys.set(item.key, item)
    }

    for (const [key, { file, line }] of uniqueKeys) {
      console.log(`  - ${key}`)
      console.log(`    (used in ${file}:${line})`)
    }
  }

  process.exit(1)
}

main()
