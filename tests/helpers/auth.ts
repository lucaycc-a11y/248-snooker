/**
 * Authentication helper for Playwright tests
 * Provides loginAsMember() utility for test setup
 */

import type { Page } from '@playwright/test'

export async function loginAsMember(page: Page, email: string) {
  // This is a placeholder - implement actual login flow
  // For now, assumes test environment has auth bypass or test credentials
  
  // Navigate to login page
  await page.goto('/login')
  
  // Fill in credentials
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'test-password')
  
  // Submit form
  await page.click('button[type="submit"]')
  
  // Wait for redirect to member area
  await page.waitForURL('/member')
}
