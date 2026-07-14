'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NfcRegistrationStatus = 'pending' | 'scanned' | 'confirmed' | 'cancelled' | 'expired'

interface RegistrationState {
  status: NfcRegistrationStatus
  uid: string | null
}

function isRegistrationStatus(value: unknown): value is NfcRegistrationStatus {
  return (
    value === 'pending' ||
    value === 'scanned' ||
    value === 'confirmed' ||
    value === 'cancelled' ||
    value === 'expired'
  )
}

export function useNfcRegistrationStatus(requestId: string | null): RegistrationState {
  const [state, setState] = useState<RegistrationState>({ status: 'pending', uid: null })

  useEffect(() => {
    if (!requestId) {
      setState({ status: 'pending', uid: null })
      return
    }

    setState({ status: 'pending', uid: null })

    const supabase = createClient()
    const channel = supabase
      .channel(`door-registration-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'door_card_registration_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as { status?: unknown; uid?: unknown }
          setState({
            status: isRegistrationStatus(row.status) ? row.status : 'pending',
            uid: typeof row.uid === 'string' ? row.uid : null,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId])

  return state
}
