/**
 * Playwright Auth Helper - Mint sessions without OTP (local only)
 *
 * Usage in tests:
 *   import { loginAsMember } from './helpers/auth'
 *   await loginAsMember(page, 'user@example.com')
 *
 * SECURITY: Only works locally. Uses SUPABASE_SERVICE_ROLE_KEY from .env.local
 * to mint a session JWT directly, bypassing OTP verification.
 *
 * Never commit .env.local. Never use this pattern in production code.
 */

import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local'
  )
}

/**
 * Log in as a member by email, bypassing OTP.
 * Sets the session cookie so subsequent requests are authenticated.
 *
 * @param page - Playwright page instance
 * @param email - User email (must exist in users table)
 */
export async function loginAsMember(page: Page, email: string): Promise<void> {
  // Create admin client with service role key
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Get user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    throw new Error(`Failed to list users: ${userError.message}`)
  }

  const user = userData.users.find(u => u.email === email)

  if (!user) {
    throw new Error(`User not found: ${email}`)
  }

  // Generate session for this user
  const { data: sessionData, error: sessionError } =
    await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

  if (sessionError || !sessionData) {
    throw new Error(`Failed to generate session: ${sessionError?.message}`)
  }

  // Extract access and refresh tokens from the magic link
  // Link format: https://.../auth/v1/verify?token=...&type=magiclink
  const linkUrl = new URL(sessionData.properties.action_link)
  const token = linkUrl.searchParams.get('token')

  if (!token) {
    throw new Error('No token in magic link')
  }

  // Exchange token for session
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'magiclink',
  })

  if (verifyError || !verifyData.session) {
    throw new Error(`Failed to verify token: ${verifyError?.message}`)
  }

  const { access_token, refresh_token } = verifyData.session

  // Inject session into browser via cookie
  // Supabase stores session in localStorage, so we set it there
  await page.goto('/')
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'test-user' }, // minimal user object
      }

      localStorage.setItem(
        'sb-wqmciwieiqvnswvspdyz-auth-token',
        JSON.stringify(session)
      )
    },
    { accessToken: access_token, refreshToken: refresh_token }
  )

  // Reload to apply session
  await page.reload()
}

/**
 * Log out the current user by clearing the session.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('sb-wqmciwieiqvnswvspdyz-auth-token')
  })
  await page.reload()
}
