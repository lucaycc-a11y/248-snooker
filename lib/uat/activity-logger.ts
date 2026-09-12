// Activity logger for UAT debug panel - captures console logs and fetch requests
// in memory (capped ring buffer) for debugging purposes.

export type ActivityEntry =
  | {
      type: 'console'
      level: 'log' | 'warn' | 'error'
      timestamp: number
      args: unknown[]
    }
  | {
      type: 'fetch'
      timestamp: number
      url: string
      method: string
      status?: number
      duration?: number
      error?: string
    }

const MAX_ENTRIES = 200
let entries: ActivityEntry[] = []
let listeners: Array<() => void> = []

// Patch console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
}

function patchConsole() {
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args)
    addEntry({ type: 'console', level: 'log', timestamp: Date.now(), args })
  }
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args)
    addEntry({ type: 'console', level: 'warn', timestamp: Date.now(), args })
  }
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args)
    addEntry({ type: 'console', level: 'error', timestamp: Date.now(), args })
  }
}

// Patch fetch
const originalFetch = globalThis.fetch

function patchFetch() {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    const startTime = Date.now()

    const entry: ActivityEntry = {
      type: 'fetch',
      timestamp: startTime,
      url,
      method,
    }

    try {
      const response = await originalFetch(input, init)
      entry.status = response.status
      entry.duration = Date.now() - startTime
      addEntry(entry)
      return response
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error)
      entry.duration = Date.now() - startTime
      addEntry(entry)
      throw error
    }
  }
}

function addEntry(entry: ActivityEntry) {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.shift()
  }
  notifyListeners()
}

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

export function initActivityLogger() {
  if (typeof window === 'undefined') return
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') return

  patchConsole()
  patchFetch()
}

export function useActivityLog(callback: () => void) {
  if (typeof window === 'undefined') return

  listeners.push(callback)
  return () => {
    listeners = listeners.filter((fn) => fn !== callback)
  }
}

export function getActivityEntries(): ActivityEntry[] {
  return [...entries]
}

export function clearActivityLog() {
  entries = []
  notifyListeners()
}

export function exportActivityLog(): string {
  return entries
    .map((entry) => {
      if (entry.type === 'console') {
        const time = new Date(entry.timestamp).toISOString()
        const args = entry.args.map((arg) => {
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          } catch {
            return String(arg)
          }
        }).join(' ')
        return `[${time}] [${entry.level.toUpperCase()}] ${args}`
      } else {
        const time = new Date(entry.timestamp).toISOString()
        const status = entry.status ? ` ${entry.status}` : ''
        const duration = entry.duration ? ` (${entry.duration}ms)` : ''
        const error = entry.error ? ` ERROR: ${entry.error}` : ''
        return `[${time}] [FETCH] ${entry.method} ${entry.url}${status}${duration}${error}`
      }
    })
    .join('\n')
}
