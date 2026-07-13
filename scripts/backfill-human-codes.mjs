#!/usr/bin/env node
// One-off script to backfill human_code for existing bookings where human_code IS NULL.
// Run: node scripts/backfill-human-codes.mjs
//
// Reads all bookings with NULL human_code, computes SPACE8-XXXXX-X from the
// booking UUID via the same SHA-256 + alphabet logic in lib/qr/jwt.ts, and
// writes the result back to the human_code column.

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Same alphabet + checkChar logic as lib/qr/jwt.ts — must stay in sync.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function checkChar(s) {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    let v = ALPHABET.indexOf(s[i])
    if (v < 0) v = 0
    if (i % 2 === 0) v *= 2
    sum += v
  }
  return ALPHABET[sum % ALPHABET.length]
}

function humanReadableCode(bookingId) {
  const h = crypto.createHash('sha256').update(bookingId).digest()
  const body = Array.from({ length: 5 }, (_, i) => ALPHABET[h[i] % ALPHABET.length]).join('')
  return `SPACE8-${body}-${checkChar(body)}`
}

async function main() {
  console.log('[backfill-human-codes] fetching bookings with NULL human_code...')
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id')
    .is('human_code', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[backfill-human-codes] fetch failed', error)
    process.exit(1)
  }

  if (!bookings || bookings.length === 0) {
    console.log('[backfill-human-codes] no bookings to backfill (all have human_code already)')
    return
  }

  console.log(`[backfill-human-codes] found ${bookings.length} bookings, generating codes...`)

  let updated = 0
  let failed = 0

  for (const booking of bookings) {
    const code = humanReadableCode(booking.id)
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ human_code: code })
      .eq('id', booking.id)

    if (updateErr) {
      console.error(`[backfill-human-codes] failed to update ${booking.id}:`, updateErr.message)
      failed++
    } else {
      updated++
      if (updated % 100 === 0) {
        console.log(`[backfill-human-codes] progress: ${updated}/${bookings.length}`)
      }
    }
  }

  console.log(`[backfill-human-codes] done: ${updated} updated, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
