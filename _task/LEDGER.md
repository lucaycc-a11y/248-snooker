# SPACE8 Auth Refactor Verification Ledger

## Goal
Complete and fully verify the SPACE8 login/signup refactor and /member guard fix.

## Hard Constraints (from task brief)
- Scope: login/signup UI and flow, /member route guard, date_of_birth field only
- DO NOT split, rewrite, move or rename AuthCard.tsx or other existing files
- Do not touch: dev2 panel, site_gate_config, is_test flags, KPay, environment-switching logic
- Environments: local and UAT only, never production
- No MIN_AGE constant, no age-limit logic anywhere
- Date of birth validation: real calendar date (leap years), not in future, year >= 1900
- Birthday purpose copy: "用於核實年齡" (until changed)
- Database: ALTER TABLE users ADD COLUMN date_of_birth DATE NULL (no default)
- OTP length follows backend (currently 6), never hardcode 4
- Country code selector: only 🇭🇰 +852 now, data structure extensible
- WhatsApp option appears only if backend provider confirmed configured; otherwise hidden
- Keep all existing login methods (Apple, Google, email, phone, password)
- All Chinese copy must be formal written Chinese (書面語), no colloquial Cantonese
- Provide zh-HK and en; state how zh-CN and ja handled via next-intl
- lib/auth/contact-validation.ts was untracked: find origin before committing

## Branch & Baseline
- Work branch: feat/auth-refactor-verify
- Safety branch: safety/pre-verify-20260924-2101
- Baseline SHA: b7ea5365af8a981031a6d5f8976a97c87ce15394
- Mirror location: ~/space8-task-mirror/20260924-2101

## Task Progress

| ID | Description | Status | Evidence | Commit |
|----|-------------|--------|----------|--------|
| SETUP-1 | Record baseline state | DONE | _task/00-baseline.txt | - |
| SETUP-2 | Create safety branch | DONE | safety/pre-verify-20260924-2101 | - |
| SETUP-3 | Create external mirror | DONE | ~/space8-task-mirror/20260924-2101 | - |
| SETUP-4 | Create work branch | DONE | feat/auth-refactor-verify | - |
| SETUP-5 | Initialize ledger | IN_PROGRESS | _task/LEDGER.md | - |
| A1 | Audit /member guard | TODO | - | - |
| A2 | Audit Identify step | TODO | - | - |
| A3 | Audit OTP step | TODO | - | - |
| A4 | Audit Profile step & DB | TODO | - | - |
| A5 | Audit UI, i18n, a11y, quality | TODO | - | - |
| A6 | Audit scope and safety | TODO | - | - |

## Decision Log
1. Working on feat/auth-refactor-verify branch, not main
2. Using sub-agents for all audit and fix tasks to preserve context
3. One writing sub-agent at a time to avoid conflicts
4. Orchestrator (this agent) commits after reviewing sub-agent diffs

## Open Questions for User
None yet.

## Notes
- lib/auth/contact-validation.ts origin investigation required before commit
- WhatsApp provider configuration check required
- Migration SQL must be approved before UAT application
