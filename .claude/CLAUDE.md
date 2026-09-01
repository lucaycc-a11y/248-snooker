# Space8 — Claude Code Instructions

## Skills (project-level, in .claude/skills/) — auto-load when relevant; treat as mandatory reading:
- apple-ui — any UI/component/styling work, emphasizing clean aesthetics
- booking-flow — anything booking-related
- brandkit — brand assets and guidelines
- design-taste-frontend / design-taste-frontend-v1 — frontend styling and design system rules
- efficient-engineering — optimized and clean coding practices
- full-output-enforcement — strictly prevent truncated or partial outputs
- git-workflow — committing/pushing when done
- gpt-taste — AI output formatting and styling preferences
- high-end-visual-design — premium, high-quality visual execution
- image-to-code — converting design mockups to functional code
- imagegen-frontend-mobile / imagegen-frontend-web — generating UI layouts for specific platforms
- impeccable — flawless code quality enforcement
- industrial-brutalist-ui — raw, structural UI components
- karpathy-guidelines — AI/software engineering best practices
- minimalist-ui — clean, essentialist design implementation
- nextjs-patterns — pages, API routes, components
- redesign-existing-projects — refactoring and overhauling current UI
- security-backend — any API/DB/auth/Stripe/QR work
- stitch-design-taste — core design taste and component structure

## Official skills installed
- webapp-testing (anthropics/skills) — Playwright browser testing, in .agents/skills/

## Project
- Site: space8.com.hk
- Stack: Next.js 14 App Router, TypeScript strict, Tailwind, Framer Motion, Supabase, Stripe
- Structure: repo root (app/, components/, lib/) — NO src/ dir
- Supabase: wqmciwieiqvnswvspdyz
- Repo:(https://github.com/lucaycc-a11y/248-snooker)
- Vercel team: lucaycc-3022s-projects

- All new visible text should go through `CMSText` or `next-intl`, keyed for CMS sync.
- Run `npm run cms:sync` after adding or changing user-visible text.

## Timeout Prevention (CRITICAL)
- **Do not exceed 30 seconds of processing time per step.** To prevent API gateway timeouts (503) or context errors, break down complex tasks, large file reads, or extensive refactoring into smaller, incremental steps. Avoid long "thinking", "compaction", or "smooshing" phases. Output progress frequently. If the user interrupts you (e.g., via Ctrl+C), gracefully acknowledge and ask for the prompt to be broken down.

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.