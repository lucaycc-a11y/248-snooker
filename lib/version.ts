/**
 * Single source of truth for app version
 * Reads from package.json at build time
 */

import packageJson from '@/package.json'

export const APP_VERSION = packageJson.version

export function formatVersion(version: string = APP_VERSION): string {
  return `v${version}`
}
