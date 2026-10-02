import { getServiceSupabase } from '@/lib/supabase/service'

export interface ConfigValue {
  key: string
  value: unknown
  category?: string
  description?: string
}

interface ConfigCache {
  data: Record<string, unknown>
  timestamp: number
}

let configCache: ConfigCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches all config from Supabase and returns a flat key-value map.
 * Caches for 5 minutes to reduce DB calls during ISR.
 */
export async function getConfig(): Promise<Record<string, unknown>> {
  const now = Date.now()

  if (configCache && now - configCache.timestamp < CACHE_TTL) {
    return configCache.data
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('config')
    .select('key, value')
    .order('key')

  if (error) {
    console.error('[help/loader] Failed to load config:', error)
    return {}
  }

  const map: Record<string, unknown> = {}
  for (const row of data || []) {
    map[row.key] = row.value
  }

  configCache = { data: map, timestamp: now }
  return map
}

/**
 * Resolves a token like "config.pricing_rates.morning.rate" to the actual value.
 * Returns the token itself if not found.
 */
export function resolveToken(token: string, config: Record<string, unknown>): string {
  if (!token.startsWith('config.')) {
    // Not a config token, return as-is (might be a link token)
    return token
  }

  // Extract the config key path: "config.pricing_rates.morning.rate" -> "pricing_rates.morning.rate"
  const path = token.slice(7) // Remove "config."
  const [configKey, ...subKeys] = path.split('.')

  const value = config[configKey]
  if (value === undefined) {
    console.warn(`[help/loader] Config key not found: ${configKey}`)
    return token
  }

  // Navigate nested object
  let result: unknown = value
  for (const key of subKeys) {
    if (typeof result === 'object' && result !== null && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      console.warn(`[help/loader] Config path not found: ${token}`)
      return token
    }
  }

  return String(result)
}

/**
 * Replaces all {{token}} placeholders in a string with their resolved values.
 */
export function replaceTokens(text: string, tokenMap: Record<string, string>, config: Record<string, unknown>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, token) => {
    const trimmedToken = token.trim()
    const mappedValue = tokenMap[trimmedToken]

    if (!mappedValue) {
      console.warn(`[help/loader] Token not found in tokenMap: ${trimmedToken}`)
      return match
    }

    return resolveToken(mappedValue, config)
  })
}
