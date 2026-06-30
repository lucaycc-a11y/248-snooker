"use client"

import { useCallback, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export type AuthState = {
  /** undefined while the first session check is in flight (avoids UI flicker). */
  loading: boolean
  user: User | null
  /** null until known; true/false once the users row has been read. */
  profileComplete: boolean | null
}

// Single source of truth for "is there a session, and is the profile complete?".
// Consumed by the AuthModal, the account menu, and the silent site-wide gate so
// none of them re-implement session handling. Subscribes to onAuthStateChange so
// it stays live across sign-in/out without a reload.
export function useAuthSession(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    profileComplete: null,
  })

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setState({ loading: false, user: null, profileComplete: null })
      return
    }

    // Read profile_complete for the gate. Tolerate a missing row (just-created
    // OAuth user before the callback upsert lands) by treating it as incomplete.
    const { data } = await supabase
      .from("users")
      .select("profile_complete")
      .eq("id", user.id)
      .maybeSingle()

    setState({
      loading: false,
      user,
      profileComplete: data?.profile_complete === true,
    })
  }, [])

  useEffect(() => {
    let active = true
    load()

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (!session?.user) {
        setState({ loading: false, user: null, profileComplete: null })
      } else {
        // Re-read profile_complete on any auth change (sign-in, token refresh).
        load()
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [load])

  return { ...state, refresh: load }
}
