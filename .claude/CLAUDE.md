# 248 Snooker Club — Claude Code Instructions

## Skills (project-level, in .claude/skills/) — auto-load when relevant; treat as mandatory reading:
1. apple-ui          — any UI/component/styling work
2. security-backend  — any API/DB/auth/Stripe/QR work
3. nextjs-patterns   — pages, API routes, components
4. booking-flow      — anything booking-related
5. git-workflow      — committing/pushing when done

## Official skills installed
- webapp-testing (anthropics/skills) — Playwright browser testing, in .agents/skills/

## Project
- Site: 248.formhk.com
- Stack: Next.js 14 App Router, TypeScript strict, Tailwind, Framer Motion, Supabase, Stripe
- Structure: repo root (app/, components/, lib/) — NO src/ dir
- Supabase: wqmciwieiqvnswvspdyz
- Repo: github.com/lucaycc-a11y/248-snooker
- Vercel team: lucaycc-3022s-projects

- All new visible text should go through `CMSText` or `next-intl`, keyed for CMS sync.
- Run `npm run cms:sync` after adding or changing user-visible text.
