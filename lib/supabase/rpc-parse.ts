// Type-safe RPC result parsing. Supabase RPC returns Json (string | number | boolean | Json[] | { [key: string]: Json }),
// but our RPCs have known shapes. This helper validates at runtime and narrows the type.

import type { Json } from './database.types'

export class RpcParseError extends Error {
  constructor(
    public rpcName: string,
    public reason: string,
  ) {
    super(`RPC ${rpcName}: ${reason}`)
    this.name = 'RpcParseError'
  }
}

// Guard: check the shape matches T at runtime
type Guard<T> = (val: unknown) => val is T

export function parseRpc<T>(rpcName: string, data: Json | null, guard: Guard<T>): T {
  if (data === null) {
    throw new RpcParseError(rpcName, 'returned null')
  }
  if (!guard(data)) {
    throw new RpcParseError(rpcName, 'shape mismatch')
  }
  return data
}

// Common guards for booking RPCs
export function isLockSlotResult(val: unknown): val is { success: boolean; reason?: string; slot_id?: string; locked_until?: string } {
  if (typeof val !== 'object' || val === null) return false
  const x = val as Record<string, unknown>
  return (
    typeof x.success === 'boolean' &&
    (x.reason === undefined || typeof x.reason === 'string') &&
    (x.slot_id === undefined || typeof x.slot_id === 'string') &&
    (x.locked_until === undefined || typeof x.locked_until === 'string')
  )
}

export function isLockSlotsResult(val: unknown): val is { success: boolean; reason?: string; slot_ids?: string[]; locked_until?: string } {
  if (typeof val !== 'object' || val === null) return false
  const x = val as Record<string, unknown>
  return (
    typeof x.success === 'boolean' &&
    (x.reason === undefined || typeof x.reason === 'string') &&
    (x.slot_ids === undefined || (Array.isArray(x.slot_ids) && x.slot_ids.every((s) => typeof s === 'string'))) &&
    (x.locked_until === undefined || typeof x.locked_until === 'string')
  )
}

export function isReleaseLockResult(val: unknown): val is { released: number } {
  if (typeof val !== 'object' || val === null) return false
  const x = val as Record<string, unknown>
  return typeof x.released === 'number'
}

export function isConfirmBookingResult(val: unknown): val is { success: boolean; booking_id?: string; error?: string } {
  if (typeof val !== 'object' || val === null) return false
  const x = val as Record<string, unknown>
  return (
    typeof x.success === 'boolean' &&
    (x.booking_id === undefined || typeof x.booking_id === 'string') &&
    (x.error === undefined || typeof x.error === 'string')
  )
}

export function isConfirmBookingGroupResult(val: unknown): val is { success: boolean; booking_ids?: string[]; error?: string } {
  if (typeof val !== 'object' || val === null) return false
  const x = val as Record<string, unknown>
  return (
    typeof x.success === 'boolean' &&
    (x.booking_ids === undefined || (Array.isArray(x.booking_ids) && x.booking_ids.every((id) => typeof id === 'string'))) &&
    (x.error === undefined || typeof x.error === 'string')
  )
}
