import { isValidLocale } from '@/i18n/enabled-locales'

// Christmas wording is defined as an overlay in messages/xmas-test/{locale}.json.
// A "pair" maps the normal sentence on the site to its Christmas version, so the
// browser can swap text for the chosen admins without touching the static pages.

export type ChristmasPair = readonly [original: string, christmas: string]

type Tree = { [key: string]: string | Tree }

function lookup(tree: Tree, path: string[]): string | null {
  let node: string | Tree = tree
  for (const key of path) {
    if (typeof node !== 'object') return null
    const next: string | Tree | undefined = node[key]
    if (next === undefined) return null
    node = next
  }
  return typeof node === 'string' ? node : null
}

function collect(over: Tree, base: Tree, path: string[], out: ChristmasPair[]): void {
  for (const [key, value] of Object.entries(over)) {
    if (typeof value === 'string') {
      const original = lookup(base, [...path, key])
      if (original && original !== value) out.push([original, value])
    } else {
      collect(value, base, [...path, key], out)
    }
  }
}

export async function getChristmasPairs(locale: string): Promise<ChristmasPair[]> {
  if (!isValidLocale(locale)) return []
  try {
    const base = (await import(`../../messages/${locale}.json`)).default as Tree
    const over = (await import(`../../messages/xmas-test/${locale}.json`)).default as Tree
    const out: ChristmasPair[] = []
    collect(over, base, [], out)
    return out
  } catch {
    return [] // no Christmas wording for this locale: only the snow shows
  }
}
