#!/usr/bin/env node
/**
 * check-hooks.mjs
 * Ensures React hooks (functions named use[A-Z]...) are only called inside function components or custom hooks.
 * Catches module-level hook calls that would break SSR/prerendering.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import ts from 'typescript'

const HOOK_PATTERN = /^use[A-Z]/

function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir)
  for (const file of files) {
    const fullPath = join(dir, file)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        getAllTsFiles(fullPath, fileList)
      }
    } else if (['.ts', '.tsx'].includes(extname(file))) {
      fileList.push(fullPath)
    }
  }
  return fileList
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  )

  const violations = []
  let currentFunctionDepth = 0

  function visit(node) {
    // Track when we enter/exit function scope
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      currentFunctionDepth++
      ts.forEachChild(node, visit)
      currentFunctionDepth--
      return
    }

    // Check for hook calls (use* functions)
    if (ts.isCallExpression(node)) {
      const expr = node.expression
      let hookName = null

      if (ts.isIdentifier(expr) && HOOK_PATTERN.test(expr.text)) {
        hookName = expr.text
      } else if (ts.isPropertyAccessExpression(expr) && HOOK_PATTERN.test(expr.name.text)) {
        hookName = expr.name.text
      }

      if (hookName && currentFunctionDepth === 0) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        violations.push({
          line: line + 1,
          hook: hookName,
          text: content.split('\n')[line]?.trim() || '',
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

function main() {
  const dirs = ['app', 'components', 'lib']
  let allFiles = []

  for (const dir of dirs) {
    try {
      allFiles = allFiles.concat(getAllTsFiles(dir))
    } catch (err) {
      // Directory might not exist
    }
  }

  let hasError = false

  for (const file of allFiles) {
    const violations = checkFile(file)
    if (violations.length > 0) {
      hasError = true
      console.error(`\n❌ ${file}`)
      for (const v of violations) {
        console.error(`   Line ${v.line}: ${v.hook}() called at module level`)
        console.error(`   ${v.text}`)
      }
    }
  }

  if (hasError) {
    console.error('\n❌ Hook violations found. Hooks must be called inside components or custom hooks.')
    process.exit(1)
  } else {
    console.log('✅ No module-level hook calls found')
  }
}

main()
