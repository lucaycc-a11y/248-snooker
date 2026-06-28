import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-aware drop-in replacements for next/link & next/navigation.
// These preserve the active locale across internal navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
