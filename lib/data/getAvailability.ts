type UnavailableSlot = string

// TODO: connect Supabase
export async function getAvailability(date: string, tableId?: string): Promise<UnavailableSlot[]> {
  return ['02:00', '03:00', '14:00', '15:00', '16:00']
}
