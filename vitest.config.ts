import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirrors the "@/*" -> "./*" alias in tsconfig.json. Without it, any test that
// exercises an API route fails at import time, because route handlers import via
// "@/lib/...". Tests using relative imports worked before this file existed,
// which is why the missing alias went unnoticed.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['{app,lib,components}/**/*.test.{ts,tsx}'],
  },
})
