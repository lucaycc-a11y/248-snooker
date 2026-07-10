// Space8 Planet-based Member Code System
// Format: SPACE8-{PLANET}-{4chars}-{checksum}
// Example: SPACE8-MARS-K7Q2-B

export const PLANET_POOL = [
  // Solar System planets
  "MARS", "VENUS", "EARTH", "PLUTO", "MERCURY", "JUPITER", "SATURN", "URANUS", "NEPTUNE",
  // Dwarf planets & large moons
  "CERES", "ERIS", "MOON", "LUNA", "IO", "RHEA", "DIONE", "MIMAS", "TITAN",
  "ARIEL", "LEDA", "ELARA", "METIS", "THEBE", "CARME", "NAIAD",
  // Asteroids
  "VESTA", "JUNO", "HEBE", "IRIS", "FLORA",
  // Stars
  "VEGA", "RIGEL", "MIRA", "SPICA", "DENEB", "ALGOL",
  // Named celestial objects
  "ORION", "NOVA", "COMET", "STAR", "SOLAR", "ATLAS", "SEDNA", "HYDRA"
] as const

export type PlanetName = typeof PLANET_POOL[number]

// Luhn checksum (single digit/letter)
function luhnChecksum(input: string): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let sum = 0
  const normalized = input.toUpperCase().replace(/[^0-9A-Z]/g, "")

  for (let i = 0; i < normalized.length; i++) {
    const charIndex = chars.indexOf(normalized[i])
    const value = charIndex >= 0 ? charIndex : 0
    const doubled = i % 2 === 0 ? value * 2 : value
    sum += doubled > 35 ? doubled - 35 : doubled
  }

  const checkDigit = (36 - (sum % 36)) % 36
  return chars[checkDigit]
}

// Generate deterministic planet + code from user ID
export function generateMemberCode(userId: string): string {
  // Deterministic planet selection from user ID
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  const planetIndex = Math.abs(hash) % PLANET_POOL.length
  const planet = PLANET_POOL[planetIndex]

  // Generate 4-character code from user ID
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const code4 = (clean.slice(0, 4) + 'AAAA').slice(0, 4)

  // Calculate checksum
  const baseString = `SPACE8${planet}${code4}`
  const checksum = luhnChecksum(baseString)

  return `SPACE8-${planet}-${code4}-${checksum}`
}

// Extract planet name from member code
export function extractPlanetFromCode(memberCode: string): PlanetName | null {
  const match = memberCode.match(/SPACE8-([A-Z]+)-/)
  if (!match) return null
  const planet = match[1] as PlanetName
  return PLANET_POOL.includes(planet) ? planet : null
}

// Planet metadata for 3D rendering and display
export type PlanetMeta = {
  name: PlanetName
  displayName: string
  color: string // Primary color for fallback/accent
  type: "planet" | "moon" | "dwarf" | "asteroid" | "star" | "nebula"
  textureSource: "solarsystem" | "procedural" // Whether we have real NASA texture
}

export const PLANET_METADATA: Record<PlanetName, PlanetMeta> = {
  // Real planets with NASA textures
  MARS: { name: "MARS", displayName: "火星", color: "#CD5C5C", type: "planet", textureSource: "solarsystem" },
  VENUS: { name: "VENUS", displayName: "金星", color: "#FFA07A", type: "planet", textureSource: "solarsystem" },
  EARTH: { name: "EARTH", displayName: "地球", color: "#4682B4", type: "planet", textureSource: "solarsystem" },
  MERCURY: { name: "MERCURY", displayName: "水星", color: "#A9A9A9", type: "planet", textureSource: "solarsystem" },
  JUPITER: { name: "JUPITER", displayName: "木星", color: "#DAA520", type: "planet", textureSource: "solarsystem" },
  SATURN: { name: "SATURN", displayName: "土星", color: "#F0E68C", type: "planet", textureSource: "solarsystem" },
  URANUS: { name: "URANUS", displayName: "天王星", color: "#4FD1C7", type: "planet", textureSource: "solarsystem" },
  NEPTUNE: { name: "NEPTUNE", displayName: "海王星", color: "#4169E1", type: "planet", textureSource: "solarsystem" },
  PLUTO: { name: "PLUTO", displayName: "冥王星", color: "#8B7D6B", type: "dwarf", textureSource: "solarsystem" },

  // Moons with textures
  MOON: { name: "MOON", displayName: "月球", color: "#C0C0C0", type: "moon", textureSource: "solarsystem" },
  LUNA: { name: "LUNA", displayName: "露娜", color: "#D3D3D3", type: "moon", textureSource: "solarsystem" },
  IO: { name: "IO", displayName: "木衛一", color: "#FFDB58", type: "moon", textureSource: "solarsystem" },
  TITAN: { name: "TITAN", displayName: "土衛六", color: "#F4A460", type: "moon", textureSource: "solarsystem" },

  // Moons/asteroids - procedural
  CERES: { name: "CERES", displayName: "穀神星", color: "#B0B0B0", type: "dwarf", textureSource: "procedural" },
  ERIS: { name: "ERIS", displayName: "鬩神星", color: "#E0E0E0", type: "dwarf", textureSource: "procedural" },
  RHEA: { name: "RHEA", displayName: "土衛五", color: "#D8D8D8", type: "moon", textureSource: "procedural" },
  DIONE: { name: "DIONE", displayName: "土衛四", color: "#C8C8C8", type: "moon", textureSource: "procedural" },
  MIMAS: { name: "MIMAS", displayName: "土衛一", color: "#B8B8B8", type: "moon", textureSource: "procedural" },
  ARIEL: { name: "ARIEL", displayName: "天衛一", color: "#9ACDFF", type: "moon", textureSource: "procedural" },
  LEDA: { name: "LEDA", displayName: "木衛十三", color: "#A8A8A8", type: "moon", textureSource: "procedural" },
  ELARA: { name: "ELARA", displayName: "木衛七", color: "#989898", type: "moon", textureSource: "procedural" },
  METIS: { name: "METIS", displayName: "木衛十六", color: "#888888", type: "moon", textureSource: "procedural" },
  THEBE: { name: "THEBE", displayName: "木衛十四", color: "#A0A0A0", type: "moon", textureSource: "procedural" },
  CARME: { name: "CARME", displayName: "木衛十一", color: "#787878", type: "moon", textureSource: "procedural" },
  NAIAD: { name: "NAIAD", displayName: "海衛三", color: "#6A9BD8", type: "moon", textureSource: "procedural" },

  // Asteroids
  VESTA: { name: "VESTA", displayName: "灶神星", color: "#D2B48C", type: "asteroid", textureSource: "procedural" },
  JUNO: { name: "JUNO", displayName: "婚神星", color: "#C9A876", type: "asteroid", textureSource: "procedural" },
  HEBE: { name: "HEBE", displayName: "青春星", color: "#DEB887", type: "asteroid", textureSource: "procedural" },
  IRIS: { name: "IRIS", displayName: "彩虹星", color: "#E6C7A6", type: "asteroid", textureSource: "procedural" },
  FLORA: { name: "FLORA", displayName: "花神星", color: "#F5DEB3", type: "asteroid", textureSource: "procedural" },

  // Stars - bright/colorful procedural
  VEGA: { name: "VEGA", displayName: "織女星", color: "#A8D8FF", type: "star", textureSource: "procedural" },
  RIGEL: { name: "RIGEL", displayName: "參宿七", color: "#B0E0FF", type: "star", textureSource: "procedural" },
  MIRA: { name: "MIRA", displayName: "鯨魚座ο", color: "#FF6B6B", type: "star", textureSource: "procedural" },
  SPICA: { name: "SPICA", displayName: "角宿一", color: "#D0E8FF", type: "star", textureSource: "procedural" },
  DENEB: { name: "DENEB", displayName: "天津四", color: "#FFE4B5", type: "star", textureSource: "procedural" },
  ALGOL: { name: "ALGOL", displayName: "大陵五", color: "#FFA07A", type: "star", textureSource: "procedural" },

  // Named celestial
  ORION: { name: "ORION", displayName: "獵戶座", color: "#4B0082", type: "nebula", textureSource: "procedural" },
  NOVA: { name: "NOVA", displayName: "新星", color: "#FFD700", type: "star", textureSource: "procedural" },
  COMET: { name: "COMET", displayName: "彗星", color: "#00CED1", type: "nebula", textureSource: "procedural" },
  STAR: { name: "STAR", displayName: "恆星", color: "#FFFFE0", type: "star", textureSource: "procedural" },
  SOLAR: { name: "SOLAR", displayName: "太陽", color: "#FFA500", type: "star", textureSource: "procedural" },
  ATLAS: { name: "ATLAS", displayName: "阿特拉斯", color: "#B0C4DE", type: "star", textureSource: "procedural" },
  SEDNA: { name: "SEDNA", displayName: "塞德娜", color: "#8B0000", type: "dwarf", textureSource: "procedural" },
  HYDRA: { name: "HYDRA", displayName: "長蛇座", color: "#9370DB", type: "nebula", textureSource: "procedural" },
}
