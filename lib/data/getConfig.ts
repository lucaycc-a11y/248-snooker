type SiteConfig = {
  pricePerHour: number
  currency: string
  maxHours: number
  openHour: number
  closeHour: number
}

// TODO: connect Supabase
export async function getConfig(): Promise<SiteConfig> {
  return {
    pricePerHour: 120,
    currency: 'HKD',
    maxHours: 6,
    openHour: 0,
    closeHour: 24,
  }
}
