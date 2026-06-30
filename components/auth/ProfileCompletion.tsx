"use client"

import { useState } from "react"
import { validateProfile, type ProfileValidation } from "@/lib/auth/profile"

const BRASS = "#c9a876"
const DEEP = "#0a1a0f"

// Mandatory first-sign-in profile step. Name + email + phone are ALL required for
// every method (SMS users lack email; Apple/Google users lack a verified phone).
// Validates client-side for instant feedback, then POSTs to /api/profile/complete
// which re-validates authoritatively. Cannot be dismissed — the parent renders it
// as a blocking step and only advances on the onComplete callback.
export function ProfileCompletion({
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  onComplete,
  labels,
}: {
  initialName?: string
  initialEmail?: string
  initialPhone?: string
  onComplete: () => void
  labels: {
    title: string
    subtitle: string
    name: string
    email: string
    phone: string
    submit: string
    saving: string
    err_name: string
    err_email: string
    err_phone: string
    err_generic: string
  }
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [saving, setSaving] = useState(false)
  const [errField, setErrField] = useState<"name" | "email" | "phone" | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const errorFor = (v: ProfileValidation): string => {
    if (v.ok) return ""
    return v.field === "name" ? labels.err_name : v.field === "email" ? labels.err_email : labels.err_phone
  }

  const submit = async () => {
    const v = validateProfile({ name, email, phone })
    if (!v.ok) {
      setErrField(v.field)
      setErrMsg(errorFor(v))
      return
    }
    setErrField(null)
    setErrMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        if (res.status === 422 && j.field) {
          setErrField(j.field)
          setErrMsg(j.field === "name" ? labels.err_name : j.field === "email" ? labels.err_email : labels.err_phone)
        } else {
          setErrMsg(labels.err_generic)
        }
        setSaving(false)
        return
      }
      onComplete()
    } catch {
      setErrMsg(labels.err_generic)
      setSaving(false)
    }
  }

  const fieldStyle = (field: "name" | "email" | "phone") => ({
    width: "100%",
    height: 52,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${errField === field ? "#f87171" : "rgba(255,255,255,0.14)"}`,
    borderRadius: 12,
    padding: "0 16px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  })

  return (
    <div>
      <h2
        data-cms-key="auth.profile.title"
        style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, letterSpacing: "0.02em", color: "#fff", marginBottom: 6 }}
      >
        {labels.title}
      </h2>
      <p data-cms-key="auth.profile.subtitle" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>
        {labels.subtitle}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.name}
          autoComplete="name"
          aria-label={labels.name}
          style={fieldStyle("name")}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.email}
          autoComplete="email"
          inputMode="email"
          aria-label={labels.email}
          style={fieldStyle("email")}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={labels.phone}
          autoComplete="tel"
          inputMode="tel"
          aria-label={labels.phone}
          style={fieldStyle("phone")}
        />
      </div>

      {errMsg && (
        <p data-cms-key="auth.profile.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
          {errMsg}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        data-cms-key="auth.profile.submit"
        style={{
          marginTop: 24,
          width: "100%",
          height: 52,
          border: "none",
          borderRadius: 12,
          background: saving ? "rgba(201,168,118,0.5)" : BRASS,
          color: DEEP,
          fontWeight: 700,
          fontSize: 16,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? labels.saving : labels.submit}
      </button>
    </div>
  )
}
