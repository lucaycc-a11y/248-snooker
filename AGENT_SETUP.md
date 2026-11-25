# Agent setup guide (Space8 / 248-snooker)

Read this first if you are an AI agent (or a new developer) working on this repo.

## 1. Project at a glance

- Site: space8.com.hk. Next.js 14 App Router, TypeScript strict, Tailwind, Framer Motion.
- Backend: Supabase (Postgres + Auth + Storage), Stripe, Resend. Hosting: Vercel.
- Locales: next-intl, `zh-HK` (default), `zh-CN`, `en`, `ja`.
- Repo root has `app/`, `components/`, `lib/` — there is **no `src/`**.
- Project instructions live in `CLAUDE.md` and `.claude/CLAUDE.md`; skills in `.claude/skills/`. Read them before changing anything.

## 2. Setup

```bash
git clone https://github.com/lucaycc-a11y/248-snooker.git
cd 248-snooker
npm install
cp .env.example .env.local     # if present; ask the owner for the values
npm run dev
```

Secrets (Supabase service-role key, Stripe, Resend) are never committed and never
pasted into chat or docs. Ask the owner; do not guess or print them.

If you cannot install packages or run a local build (e.g. no network), say so and
rely on the Vercel preview build for verification (see section 5).

## 3. Hard rules

- Never use `any` — use `unknown` plus type guards.
- Prices, booking times and tiers live only in the `config` table. Never hardcode.
- Server Supabase clients must use `createRouteHandlerClient({ cookies })`, never a bare anon-key `createClient()` (this caused silent 401s). Bearer-token routes for the iOS app use `lib/admin/bearer-auth.ts`.
- User-facing text goes through `CMSText` / next-intl with `data-cms-key`; run `npm run cms:sync` after adding text.
- Files kebab-case, components PascalCase, hooks `use*`.
- Do not touch unrelated files. Stage explicit paths, never `git add -A`.

## 4. Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | local dev server |
| `npx tsc --noEmit` | type check |
| `npm run build` | full build (i18n key check + zh-HK traditional check + next build) |
| `npm test` | hook check + vitest |
| `npm run cms:sync` | sync user-visible text to CMS |
| `graphify query "<question>"` | codebase questions when `graphify-out/graph.json` exists |
| `graphify update .` | refresh the graph after code changes |

## 5. Push gate (mandatory)

1. Work on a feature branch, never directly on `main` or `uat`.
2. Before any push to `uat`/`main`, `npm run build` and `npx tsc --noEmit` must pass on that exact commit. If you cannot run them, push the branch and wait for the Vercel preview commit status to be `success`.
3. Fix build errors in one batch; do not push `fix(build)` commits one at a time.
4. Release to `main` only when the owner says so, as a fast-forward of the verified commit. No force-push, rebase, tag/branch deletion, `vercel --prod`, or Vercel Redeploy/Promote.

## 6. Versioning (every push)

Every push adds a migration in `supabase/migrations/` that inserts a row into `public.app_versions` (`INSERT … ON CONFLICT (version) DO NOTHING`) with `adds` / `changes` / `removes`. The version is the next patch after the newest row; `app_versions` (not `package.json`) is the source of truth.

- A **future** `released_at` makes a test version, visible only to admins as `vX.X.X（test）`.
- Release to everyone from `/admin/versions` → 發佈給所有人 (sets `released_at` to now, no redeploy).

## 7. Admin and iOS API

Admin pages live under `app/admin/`. The iOS app calls `app/api/admin/app/*`; see
`docs/ios-admin-api.md`.

## 8. Working style

- Surgical changes: do what was asked, match existing style, remove only what your change orphaned.
- State assumptions; define how you will verify; report what you could not verify.
- The owner writes Cantonese; reply in written Chinese (書面語) unless asked otherwise.
