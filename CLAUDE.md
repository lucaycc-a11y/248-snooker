# CLAUDE.md

## Stack
- Next.js 14 App Router, TypeScript strict, Tailwind
- Supabase (Postgres + Auth + Storage), Stripe, Resend
- next-intl (4 locales: zh-HK default, zh-CN, en, ja)

## Constraints
- Never use `any`. Use `unknown` + type guards.
- Price/booking-time/tier logic lives only in `config` table — never hardcode.
- All server-side Supabase clients must use `createRouteHandlerClient({ cookies })`,
  never a bare anon-key `createClient()` — this has caused silent 401s before.
- CMS text uses `data-cms-key` attributes — never hardcode user-facing strings.

## Naming
- Files: kebab-case. Components: PascalCase. Hooks: use* prefix.

## Working style
- Follow the `karpathy-guidelines` and `efficient-engineering` skills for every
  non-trivial task, without being asked.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
