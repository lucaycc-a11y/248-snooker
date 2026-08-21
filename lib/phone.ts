import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

export function normalizePhone(raw: string, defaultCountry: CountryCode = 'HK'): string | null {
  if (!raw) return null
  try {
    if (!isValidPhoneNumber(raw, defaultCountry)) return null
    return parsePhoneNumber(raw, defaultCountry).format('E.164')
  } catch {
    return null
  }
}
