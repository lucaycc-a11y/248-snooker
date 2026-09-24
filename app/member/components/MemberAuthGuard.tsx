"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthModal } from "@/components/auth/AuthModal"
import { validateRedirectUrl } from "@/lib/auth/route-guards"

/**
 * Auth guard for /member route.
 * Shows AuthModal over a dark background when user is unauthenticated.
 * After successful auth, redirects to /member to trigger a fresh server-side data fetch.
 */
export function MemberAuthGuard() {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    // Open modal after mount to prevent hydration flash
    setModalOpen(true)

    // Prevent body scroll while modal is open
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleAuthComplete = () => {
    // Refresh the page to trigger server-side data fetch with new session
    router.refresh()
  }

  const handleClose = () => {
    // User closed modal without logging in - redirect to home
    router.push("/")
  }

  // Validate the return URL to prevent open redirect vulnerabilities
  const safeReturnUrl = validateRedirectUrl("/member")

  return (
    <>
      {/* Dark background matching /member aesthetic */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]" />

      {/* AuthModal */}
      <AuthModal
        open={modalOpen}
        returnUrl={safeReturnUrl}
        onAuthComplete={handleAuthComplete}
        onClose={handleClose}
        dismissible={true}
      />
    </>
  )
}
