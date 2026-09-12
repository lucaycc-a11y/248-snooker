/**
 * Shared helper for Google reCAPTCHA v3 token generation.
 *
 * Root cause fixed here: calling `grecaptcha.execute()` immediately after
 * checking that `window.grecaptcha` exists is a race condition — the
 * reCAPTCHA v3 script exposes a `grecaptcha` object (with `.execute` and
 * `.ready` already defined) almost as soon as the <script> tag loads, but
 * the actual client isn't registered with Google's backend for our site
 * key until the internal `ready` callback fires. Calling `.execute()`
 * before that completes can return a token that Google's `siteverify`
 * endpoint rejects outright (`success: false`, no `score`/`action` in the
 * response) — which is exactly the `score: null, action: null` pattern
 * seen in production logs for `/api/otp/send`.
 *
 * Always go through `getRecaptchaToken()` instead of calling
 * `grecaptcha.execute()` directly.
 */
export async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    throw new Error("recaptcha_site_key_missing")
  }
  if (typeof window === "undefined" || !window.grecaptcha || typeof window.grecaptcha.execute !== "function") {
    throw new Error("recaptcha_not_loaded")
  }

  const grecaptcha = window.grecaptcha

  await new Promise<void>((resolve) => {
    if (typeof grecaptcha.ready === "function") {
      grecaptcha.ready(() => resolve())
    } else {
      resolve()
    }
  })

  return grecaptcha.execute(siteKey, { action })
}
